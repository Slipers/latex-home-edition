// Banc d'essai de supabase/collab.sql dans un PostgreSQL local (PGlite), avec
// une imitation minimale de Supabase : schéma auth, rôles anon/authenticated,
// realtime.messages + realtime.topic(), publication supabase_realtime.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';

const db = new PGlite({ extensions: { pgcrypto } });
// Usage : node scripts/test-sql.mjs   (vérifie supabase/collab.sql et supabase/partage.sql)
const root = new URL('..', import.meta.url);
const SQL = fs.readFileSync(new URL('supabase/collab.sql', root), 'utf8');
const SHARE_SQL = fs.readFileSync(new URL('supabase/partage.sql', root), 'utf8');
const FILES_SQL = fs.readFileSync(new URL('supabase/fichiers.sql', root), 'utf8');

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema realtime; create schema extensions;
  create extension pgcrypto schema extensions;
  create table auth.users (id uuid primary key, email text unique, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create table realtime.messages (id bigserial primary key, topic text, extension text, event text, payload jsonb);
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
  grant usage on schema public, auth, realtime, extensions to anon, authenticated;
  grant execute on function auth.uid(), auth.jwt(), realtime.topic() to anon, authenticated;
  grant select, insert on realtime.messages to authenticated;
  grant usage on sequence realtime.messages_id_seq to authenticated;
  create publication supabase_realtime;
`);
await db.exec(SQL);
await db.exec(SQL);            // le script doit pouvoir être relancé
if (SHARE_SQL) { await db.exec(SHARE_SQL); }
await db.exec(FILES_SQL);
await db.exec(FILES_SQL);      // relançable

const U = {
  alice: '11111111-1111-1111-1111-111111111111',
  bob:   '22222222-2222-2222-2222-222222222222',
  carol: '33333333-3333-3333-3333-333333333333',
  eve:   '44444444-4444-4444-4444-444444444444',   // adresse NON confirmée
};
await db.exec(`
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
   ('${U.alice}', 'alice@exemple.fr', now(), '{"pseudo":"Alice"}'),
   ('${U.bob}',   'Bob@Exemple.fr',   now(), '{"pseudo":"Bobby"}'),
   ('${U.carol}', 'carol@exemple.fr', now(), '{"pseudo":"Carol"}'),
   ('${U.eve}',   'eve@exemple.fr',   null,  '{"pseudo":"Eve"}');
`);

let ok = 0, ko = 0;
const check = (name, cond, extra) => { if (cond) ok++; else { ko++; console.log('ÉCHEC :', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
async function as(user, fn) {
  await db.exec(`reset role; set request.jwt.claim.sub = '${user ? U[user] : ''}'; set role ${user ? 'authenticated' : 'anon'};`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const fails = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

// Profils créés par le déclencheur
check('profils créés', (await q('select count(*)::int n from public.profiles'))[0].n === 4);

// Alice crée un document
const doc = await as('alice', async () => (await q(`insert into public.collab_docs (title) values ('TP chimie') returning id, owner`))[0]);
check('owner = alice', doc.owner === U.alice);
const D = doc.id;
check('alice : rôle owner', (await as('alice', () => q('select public.lhe_doc_role($1) r', [D])))[0].r === 'owner');

// Personne d'autre ne voit rien
check('bob : ne voit pas le doc', (await as('bob', () => q('select * from public.collab_docs'))).length === 0);
check('anon : refusé', await as(null, () => fails(() => q('select * from public.collab_docs'))));
check('bob : ne peut pas ouvrir', await as('bob', () => fails(() => q('select public.lhe_open_doc($1)', [D]), /LHE_FORBIDDEN/)));
check('bob : ne peut pas écrire de maj', await as('bob', () => fails(() => q(`insert into public.collab_updates (doc_id, data) values ($1, 'xx')`, [D]))));

// Alice écrit une mise à jour
await as('alice', () => q(`insert into public.collab_updates (doc_id, data) values ($1, 'AAAA')`, [D]));
check('maj alice lisible par alice', (await as('alice', () => q('select * from public.collab_updates where doc_id=$1', [D]))).length === 1);
check('maj : auteur usurpé refusé', await as('alice', () => fails(() => q(`insert into public.collab_updates (doc_id, data, author) values ($1, 'x', $2)`, [D, U.bob]))));

// Invitations
check('bob ne peut pas inviter', await as('bob', () => fails(() => q(`select public.lhe_invite($1, 'carol@exemple.fr', 'editor')`, [D]), /LHE_FORBIDDEN/)));
check('invitation soi-même refusée', await as('alice', () => fails(() => q(`select public.lhe_invite($1, 'ALICE@exemple.fr', 'editor')`, [D]), /LHE_SELF/)));
check('rôle invalide refusé', await as('alice', () => fails(() => q(`select public.lhe_invite($1, 'bob@exemple.fr', 'owner')`, [D]), /LHE_ROLE/)));
check('e-mail invalide refusé', await as('alice', () => fails(() => q(`select public.lhe_invite($1, 'pas-un-mail', 'viewer')`, [D]), /LHE_EMAIL/)));
const inv = (await as('alice', () => q(`select public.lhe_invite($1, '  BOB@exemple.FR ', 'viewer') j`, [D])))[0].j;
check('invitation bob (normalisée)', inv.email === 'bob@exemple.fr' && inv.new === true, inv);

// E-mail d'invitation : propriétaire seulement, 1 envoi / 10 min par personne
const info = (await as('alice', () => q(`select public.lhe_invite_info($1, 'bob@exemple.fr') j`, [D])))[0].j;
check('invite_info : contenu', info.email === 'bob@exemple.fr' && info.role === 'viewer' && info.title === 'TP chimie' && info.from === 'Alice' && info.has_account === true, info);
check('invite_info : renvoi immédiat limité', await as('alice', () => fails(() => q(`select public.lhe_invite_info($1, 'bob@exemple.fr')`, [D]), /LHE_RATE/)));
check('invite_info : bob refusé', await as('bob', () => fails(() => q(`select public.lhe_invite_info($1, 'bob@exemple.fr')`, [D]), /LHE_FORBIDDEN/)));
check('invite_info : adresse non invitée refusée', await as('alice', () => fails(() => q(`select public.lhe_invite_info($1, 'inconnu@exemple.fr')`, [D]), /LHE_FORBIDDEN/)));

// Bob lecteur : lit, n'écrit pas, ne commente pas
check('bob : rôle viewer', (await as('bob', () => q('select public.lhe_doc_role($1) r', [D])))[0].r === 'viewer');
check('bob : voit le doc', (await as('bob', () => q('select * from public.collab_docs'))).length === 1);
check('bob : lit les maj', (await as('bob', () => q('select * from public.collab_updates where doc_id=$1', [D]))).length === 1);
check('bob viewer : écriture refusée', await as('bob', () => fails(() => q(`insert into public.collab_updates (doc_id, data) values ($1, 'BB')`, [D]))));
check('bob viewer : commentaire refusé', await as('bob', () => fails(() => q(`insert into public.collab_comments (doc_id, body) values ($1, 'hello')`, [D]))));
check('bob viewer : renommer refusé', (await as('bob', () => q(`update public.collab_docs set title='pirate' where id=$1 returning id`, [D]))).length === 0);
const docs = await as('bob', () => q('select * from public.lhe_my_docs()'));
check('bob : mes docs', docs.length === 1 && docs[0].role === 'viewer' && docs[0].owner_pseudo === 'Alice' && docs[0].is_owner === false, docs);
check('invitation rattachée au compte de bob', (await q('select user_id from public.collab_members where email=$1', ['bob@exemple.fr']))[0].user_id === U.bob);

// Personnes : les adresses ne sont visibles que du propriétaire / éditeurs
const peopleBob = await as('bob', () => q('select * from public.lhe_doc_people($1)', [D]));
check('bob viewer : ne voit pas l\'adresse d\'alice', peopleBob.find(p => p.role === 'owner').email === null, peopleBob);
check('bob viewer : voit sa propre adresse', peopleBob.find(p => p.role === 'viewer').email === 'bob@exemple.fr');
const peopleAlice = await as('alice', () => q('select * from public.lhe_doc_people($1)', [D]));
check('alice : voit les adresses et pseudos', peopleAlice.find(p => p.role === 'viewer').pseudo === 'Bobby' && peopleAlice.find(p => p.role === 'owner').email === 'alice@exemple.fr');

// Carol n'a aucun accès ; les membres d'un document ne sont pas listables par elle
check('carol : aucun membre visible', (await as('carol', () => q('select * from public.collab_members'))).length === 0);
check('carol : lhe_doc_people refusé', await as('carol', () => fails(() => q('select * from public.lhe_doc_people($1)', [D]), /LHE_FORBIDDEN/)));

// Bob commentateur
await as('alice', () => q(`select public.lhe_invite($1, 'bob@exemple.fr', 'commenter')`, [D]));
const c1 = await as('bob', async () => (await q(`insert into public.collab_comments (doc_id, body, anchor) values ($1, 'Il manque une unité', '{"b":"x","f":"html","q":"12"}') returning id`, [D]))[0].id);
check('bob commentateur : commente', !!c1);
check('bob commentateur : toujours pas d\'écriture', await as('bob', () => fails(() => q(`insert into public.collab_updates (doc_id, data) values ($1, 'BB')`, [D]))));
check('commentaire déjà résolu à la création refusé', await as('bob', () => fails(() => q(`insert into public.collab_comments (doc_id, body, resolved) values ($1, 'x', true)`, [D]))));
const cm = await as('alice', () => q('select * from public.lhe_comments($1)', [D]));
check('commentaires avec pseudo', cm.length === 1 && cm[0].pseudo === 'Bobby', cm);
check('alice ne peut pas modifier le texte de bob', await as('alice', () => fails(() => q('select public.lhe_comment_update($1, $2, null)', [c1, 'modifié']), /LHE_FORBIDDEN/)));
check('alice (owner) peut résoudre', (await as('alice', () => q('select public.lhe_comment_update($1, null, true) r', [c1])))[0].r === true);
check('bob modifie son commentaire', (await as('bob', () => q('select public.lhe_comment_update($1, $2, null) r', [c1, 'Il manque une unité (mol/L)'])))[0].r === true);

// Bob éditeur : écrit
await as('alice', () => q(`select public.lhe_invite($1, 'bob@exemple.fr', 'editor')`, [D]));
await as('bob', () => q(`insert into public.collab_updates (doc_id, data) values ($1, 'BBBB')`, [D]));
check('bob éditeur : maj écrite', (await as('alice', () => q('select * from public.collab_updates where doc_id=$1', [D]))).length === 2);
check('bob éditeur : renomme', (await as('bob', () => q(`update public.collab_docs set title='TP chimie (v2)' where id=$1 returning id`, [D]))).length === 1);
check('bob éditeur : ne peut pas inviter', await as('bob', () => fails(() => q(`select public.lhe_invite($1, 'carol@exemple.fr', 'editor')`, [D]), /LHE_FORBIDDEN/)));
check('bob éditeur : ne peut pas supprimer le doc', (await as('bob', () => q('delete from public.collab_docs where id=$1 returning id', [D]))).length === 0);
check('bob : ne peut pas changer le propriétaire', await as('bob', () => fails(() => q('update public.collab_docs set owner=$2 where id=$1', [D, U.bob]))));
check('bob : pas de mise à jour directe du snapshot', await as('bob', () => fails(() => q(`update public.collab_docs set snapshot='x' where id=$1`, [D]))));

// Adresse non confirmée : une invitation ne donne rien
await as('alice', () => q(`select public.lhe_invite($1, 'eve@exemple.fr', 'editor')`, [D]));
check('eve (non confirmée) : aucun accès', (await as('eve', () => q('select public.lhe_doc_role($1) r', [D])))[0].r === null);
check('eve : ne lit pas les maj', (await as('eve', () => q('select * from public.collab_updates'))).length === 0);

// Canaux temps réel
async function rt(user, topic, ext, op) {
  await db.exec('reset role;');
  if (op === 'select') await q(`insert into realtime.messages (topic, extension, event) values ($1, $2, 'x')`, [topic, ext]);
  await q(`select set_config('request.jwt.claim.sub', $1, false), set_config('realtime.topic', $2, false)`, [U[user], topic]);
  await db.exec('set role authenticated;');
  try {
    if (op === 'insert') return !(await fails(() => q(`insert into realtime.messages (topic, extension, event) values ($1, $2, 'x')`, [topic, ext])));
    return (await q(`select * from realtime.messages where topic = $1 and extension = $2`, [topic, ext])).length > 0;
  } finally { await db.exec('reset role;'); }
}
const T = 'doc:' + D;
check('rt : alice diffuse', await rt('alice', T, 'broadcast', 'insert'));
check('rt : bob éditeur diffuse', await rt('bob', T, 'broadcast', 'insert'));
check('rt : carol ne diffuse pas', !(await rt('carol', T, 'broadcast', 'insert')));
check('rt : carol ne reçoit pas', !(await rt('carol', T, 'broadcast', 'select')));
check('rt : bob reçoit', await rt('bob', T, 'broadcast', 'select'));
check('rt : sujet mal formé refusé', !(await rt('alice', "doc:x' or '1'='1", 'broadcast', 'insert')));
await as('alice', () => q(`select public.lhe_invite($1, 'carol@exemple.fr', 'viewer')`, [D]));
check('rt : carol lectrice reçoit', await rt('carol', T, 'broadcast', 'select'));
check('rt : carol lectrice ne diffuse pas de modifications', !(await rt('carol', T, 'broadcast', 'insert')));
check('rt : carol lectrice a la présence', await rt('carol', T, 'presence', 'insert'));

// Compaction
const maxId = (await q('select max(id)::int m from public.collab_updates where doc_id=$1', [D]))[0].m;
check('compaction : lectrice refusée', await as('carol', () => fails(() => q('select public.lhe_compact($1, $2, $3)', [D, 'SNAP', maxId]), /LHE_FORBIDDEN/)));
check('compaction : au-delà du max refusée', (await as('bob', () => q('select public.lhe_compact($1, $2, $3) r', [D, 'SNAP', maxId + 100])))[0].r === false);
check('compaction : ok', (await as('bob', () => q('select public.lhe_compact($1, $2, $3) r', [D, 'SNAP', maxId])))[0].r === true);
check('compaction : maj récentes conservées (marge 1 min)', (await q('select count(*)::int n from public.collab_updates where doc_id=$1', [D]))[0].n === 2);
await db.exec(`update public.collab_updates set created_at = now() - interval '2 minutes'`);
check('compaction : répétée refusée (même borne)', (await as('bob', () => q('select public.lhe_compact($1, $2, $3) r', [D, 'SNAP2', maxId])))[0].r === false);
await as('alice', () => q(`insert into public.collab_updates (doc_id, data) values ($1, 'CCCC')`, [D]));
await db.exec(`update public.collab_updates set created_at = now() - interval '2 minutes'`);
const max2 = (await q('select max(id)::int m from public.collab_updates where doc_id=$1', [D]))[0].m;
check('compaction 2 : ok', (await as('alice', () => q('select public.lhe_compact($1, $2, $3) r', [D, 'SNAP3', max2])))[0].r === true);
check('compaction 2 : anciennes maj effacées', (await q('select count(*)::int n from public.collab_updates where doc_id=$1', [D]))[0].n === 0);
const open = (await as('bob', () => q('select public.lhe_open_doc($1) j', [D])))[0].j;
check('ouverture : snapshot + rôle', open.snapshot === 'SNAP3' && open.role === 'editor' && open.snapshot_upto === max2, open);

// Retirer un membre / quitter
check('bob ne peut pas retirer carol', await as('bob', () => fails(() => q(`select public.lhe_remove_member($1, 'carol@exemple.fr')`, [D]), /LHE_FORBIDDEN/)));
check('carol quitte le document', (await as('carol', () => q(`select public.lhe_remove_member($1, 'carol@exemple.fr') r`, [D])))[0].r === true);
check('carol : plus d\'accès', (await as('carol', () => q('select public.lhe_doc_role($1) r', [D])))[0].r === null);
check('alice retire bob', (await as('alice', () => q(`select public.lhe_remove_member($1, 'bob@exemple.fr') r`, [D])))[0].r === true);
check('bob : plus d\'accès', (await as('bob', () => q('select public.lhe_doc_role($1) r', [D])))[0].r === null);

// Profils : chacun ne voit / modifie que le sien
check('profil : bob ne voit que le sien', (await as('bob', () => q('select * from public.profiles'))).length === 1);
check('profil : bob change son pseudo', (await as('bob', () => q(`update public.profiles set pseudo='Bob' where id=$1 returning id`, [U.bob]))).length === 1);
check('profil : bob ne change pas celui d\'alice', (await as('bob', () => q(`update public.profiles set pseudo='X' where id=$1 returning id`, [U.alice]))).length === 0);

// Suppression de compte
await as('alice', () => q(`select public.lhe_invite($1, 'carol@exemple.fr', 'editor')`, [D]));
check('suppression du compte d\'alice', (await as('alice', () => q('select public.lhe_delete_account() r')))[0].r === true);
check('documents d\'alice supprimés', (await q('select count(*)::int n from public.collab_docs'))[0].n === 0);
check('membres supprimés en cascade', (await q('select count(*)::int n from public.collab_members'))[0].n === 0);

// Anonyme : aucune fonction
check('anon : lhe_my_docs refusé', await as(null, () => fails(() => q('select * from public.lhe_my_docs()'))));
check('anon : lhe_invite refusé', await as(null, () => fails(() => q(`select public.lhe_invite(gen_random_uuid(), 'a@b.fr', 'viewer')`))));

// Le partage par lien (partage.sql) est toujours là et intact
if (SHARE_SQL) {
  const s = (await as(null, () => q(`select public.create_share('Payload_de_test_abc', 'Titre', true) j`)))[0].j;
  check('partage.sql toujours fonctionnel', s && s.id && s.token, s);
}

// ---------------------------------------------------------------- Mes fichiers en ligne (fichiers.sql)
const fsave = (who, id, name, data, version, force) => as(who, async () => (await q('select public.lhe_file_save($1, $2, $3, $4, $5) j', [id, name, data, version, !!force]))[0].j);
const f1 = await fsave('bob', null, 'Cours de maths', 'DATA-1', null);
check('fichier : créé (version 1)', f1.id && f1.version === 1 && f1.name === 'Cours de maths', f1);
const f2 = await fsave('bob', null, 'cours de MATHS', 'DATA-X', null);
check('fichier : même nom → renommé, rien d\'écrasé', f2.name === 'cours de MATHS (2)' && f2.id !== f1.id, f2);
check('fichier : le premier est intact', (await as('bob', () => q('select data from public.lhe_files where id=$1', [f1.id])))[0].data === 'DATA-1');
check('fichier : carol ne voit rien', (await as('carol', () => q('select * from public.lhe_files'))).length === 0);
check('fichier : carol ne liste rien', (await as('carol', () => q('select * from public.lhe_my_files()'))).length === 0);
check('fichier : anon refusé (lecture)', await as(null, () => fails(() => q('select * from public.lhe_files'))));
check('fichier : anon refusé (liste)', await as(null, () => fails(() => q('select * from public.lhe_my_files()'))));
check('fichier : anon refusé (écriture)', await as(null, () => fails(() => q(`select public.lhe_file_save(null, 'x', 'y', null, false)`))));
check('fichier : carol ne peut pas écrire celui de bob', await as('carol', () => fails(() => q('select public.lhe_file_save($1, null, $2, 1, true)', [f1.id, 'PIRATE']), /LHE_GONE/)));
check('fichier : carol ne peut pas le renommer', await as('carol', () => fails(() => q(`select public.lhe_file_rename($1, 'x')`, [f1.id]), /LHE_GONE/)));
check('fichier : carol ne peut pas le jeter', await as('carol', () => fails(() => q('select public.lhe_file_trash($1, true)', [f1.id]), /LHE_GONE/)));
check('fichier : carol ne peut pas le supprimer', await as('carol', () => fails(() => q('select public.lhe_file_purge($1)', [f1.id]))));
check('fichier : carol ne peut pas le rétablir', await as('carol', () => fails(() => q('select public.lhe_file_revert($1)', [f1.id]), /LHE_GONE/)));
check('fichier : carol ne lit pas son espace', (await as('carol', () => q('select public.lhe_files_usage() j')))[0].j.count === 0);
check('fichier : écriture directe interdite', await as('bob', () => fails(() => q(`update public.lhe_files set data='Z' where id=$1`, [f1.id]))));
check('fichier : insertion directe interdite', await as('bob', () => fails(() => q(`insert into public.lhe_files (name, data) values ('a','b')`))));
check('fichier : suppression directe interdite', await as('bob', () => fails(() => q('delete from public.lhe_files where id=$1', [f1.id]))));
check('fichier : fonctions internes interdites', await as('bob', () => fails(() => q(`select public.lhe_files_free_name('x', null)`))));
check('fichier : intact après les tentatives', (await q('select data, version from public.lhe_files where id=$1', [f1.id]))[0].data === 'DATA-1');

// Versions : enregistrement normal, puis conflit (autre ordinateur resté sur une vieille version)
const v2 = await fsave('bob', f1.id, null, 'DATA-2', 1);
check('fichier : version 2', v2.version === 2 && v2.name === 'Cours de maths', v2);
check('fichier : version précédente gardée', (await q('select prev_data from public.lhe_files where id=$1', [f1.id]))[0].prev_data === 'DATA-1');
check('fichier : conflit détecté', await as('bob', () => fails(() => q('select public.lhe_file_save($1, null, $2, 1, false)', [f1.id, 'VIEUX']), /LHE_CONFLICT/)));
check('fichier : rien écrasé par le conflit', (await q('select data from public.lhe_files where id=$1', [f1.id]))[0].data === 'DATA-2');
const v3 = await fsave('bob', f1.id, null, 'DATA-3', 2);
check('fichier : enregistrement rapproché → précédente conservée', (await q('select prev_data from public.lhe_files where id=$1', [f1.id]))[0].prev_data === 'DATA-1' && v3.version === 3);
const v4 = await fsave('bob', f1.id, null, 'FORCE', 1, true);
check('fichier : forcer garde l\'écrasé comme précédente', v4.version === 4 && (await q('select prev_data from public.lhe_files where id=$1', [f1.id]))[0].prev_data === 'DATA-3');
const rv = (await as('bob', () => q('select public.lhe_file_revert($1) j', [f1.id])))[0].j;
const afterRv = (await q('select data, prev_data from public.lhe_files where id=$1', [f1.id]))[0];
check('fichier : rétablir la précédente (sans rien perdre)', rv.version === 5 && afterRv.data === 'DATA-3' && afterRv.prev_data === 'FORCE', afterRv);
check('fichier : contenu vide refusé', await as('bob', () => fails(() => q(`select public.lhe_file_save(null, 'x', '', null, false)`), /LHE_SIZE/)));

// Renommer, corbeille, restaurer, supprimer définitivement
check('fichier : renommer vers un nom pris → suffixe', (await as('bob', () => q(`select public.lhe_file_rename($1, 'Cours de maths') j`, [f2.id])))[0].j.name === 'Cours de maths (2)');
await as('bob', () => q('select public.lhe_file_trash($1, true)', [f1.id]));
check('fichier : à la corbeille, pas effacé', (await q('select deleted_at is not null t from public.lhe_files where id=$1', [f1.id]))[0].t === true);
check('fichier : on n\'enregistre pas dans la corbeille', await as('bob', () => fails(() => q('select public.lhe_file_save($1, null, $2, 5, false)', [f1.id, 'X']), /LHE_TRASHED/)));
const f3 = await fsave('bob', null, 'Cours de maths', 'NOUVEAU', null);
check('fichier : nom libéré par la corbeille', f3.name === 'Cours de maths', f3);
const rs = (await as('bob', () => q('select public.lhe_file_trash($1, false) j', [f1.id])))[0].j;
check('fichier : restauré sous un nom libre', rs.deleted_at === null && rs.name === 'Cours de maths (3)', rs);
check('fichier : suppression définitive hors corbeille refusée', await as('bob', () => fails(() => q('select public.lhe_file_purge($1)', [f1.id]), /LHE_NOT_TRASHED/)));
await as('bob', () => q('select public.lhe_file_trash($1, true)', [f3.id]));
check('fichier : suppression définitive depuis la corbeille', (await as('bob', () => q('select public.lhe_file_purge($1) r', [f3.id])))[0].r === true);
check('fichier : bien supprimé', (await q('select count(*)::int n from public.lhe_files where id=$1', [f3.id]))[0].n === 0);
await q(`update public.lhe_files set deleted_at = now() - interval '31 days' where id=$1`, [f2.id]);
const lst = await as('bob', () => q('select * from public.lhe_my_files()'));
check('fichier : corbeille de plus de 30 jours vidée', lst.length === 1 && lst[0].id === f1.id && lst[0].data === undefined, lst.map(r => r.name));
const use = (await as('bob', () => q('select public.lhe_files_usage() j')))[0].j;
check('fichier : espace utilisé', use.count === 1 && use.used === 'DATA-3'.length + 'FORCE'.length && use.max === 60000000, use);

// Limite d'espace (60 millions de caractères par compte)
let quotaHit = false;
try { for (let k = 0; k < 5; k++) await as('bob', () => q(`select public.lhe_file_save(null, 'gros', repeat('x', 14000000), null, false)`)); }
catch (e) { quotaHit = /LHE_QUOTA/.test(e.message); }
check('fichier : limite d\'espace', quotaHit);
await q(`delete from public.lhe_files where name like 'gros%'`);

// Relancer les scripts ne touche à rien
const before = (await q('select count(*)::int n, sum(version)::int v from public.lhe_files'))[0];
await db.exec(FILES_SQL);
await db.exec(SQL);
const after = (await q('select count(*)::int n, sum(version)::int v from public.lhe_files'))[0];
check('fichier : relancer les scripts ne perd rien', before.n === after.n && before.v === after.v, [before, after]);

// Compte supprimé : ses fichiers partent avec lui, pas ceux des autres
await fsave('carol', null, 'À carol', 'C', null);
await as('bob', () => q('select public.lhe_delete_account()'));
check('fichier : supprimés avec le compte', (await q('select count(*)::int n from public.lhe_files where owner=$1', [U.bob]))[0].n === 0);
check('fichier : ceux de carol intacts', (await q('select count(*)::int n from public.lhe_files where owner=$1', [U.carol]))[0].n === 1);

console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
