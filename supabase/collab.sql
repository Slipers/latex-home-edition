-- ============================================================================
--  LaTeX Home Edition — « Live Modification » : comptes et co-édition en direct
--  À coller dans Supabase : SQL Editor → New query → coller → Run.
--  Le script peut être relancé sans risque (il ne supprime aucune donnée).
--
--  Sécurité : tout passe par la sécurité au niveau des lignes (RLS). Le rôle
--  de chacun sur un document est calculé côté serveur (lhe_doc_role) :
--    owner     : le créateur — tout, dont inviter et gérer les accès
--    editor    : modifie le document en direct, commente
--    commenter : lit et commente
--    viewer    : lit seulement
--  Une invitation vise une adresse e-mail ; elle ne donne accès qu'à un
--  compte dont cette adresse a été CONFIRMÉE (lien reçu par e-mail).
--  Les canaux temps réel « doc:<id> » sont privés : seuls les membres du
--  document les reçoivent, et seuls propriétaire et éditeurs y diffusent des
--  modifications.
-- ============================================================================

-- ---------------------------------------------------------------- Profils
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  pseudo      text not null check (char_length(pseudo) between 1 and 40),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Profil créé automatiquement à l'inscription (pseudo choisi dans l'application)
create or replace function public.lhe_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, pseudo)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'pseudo'), ''), split_part(new.email, '@', 1), 'Utilisateur'), 40))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists lhe_on_auth_user_created on auth.users;
create trigger lhe_on_auth_user_created after insert on auth.users
  for each row execute function public.lhe_new_user();

-- ---------------------------------------------------------------- Documents
create table if not exists public.collab_docs (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null default '' check (char_length(title) <= 300),
  snapshot       text,                          -- état complet (Yjs, base64), réécrit par compaction
  snapshot_upto  bigint not null default 0,     -- dernière mise à jour incluse dans le snapshot
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists collab_docs_owner_idx on public.collab_docs (owner);

create table if not exists public.collab_members (
  doc_id      uuid not null references public.collab_docs (id) on delete cascade,
  email       text not null check (email = lower(email) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id     uuid references auth.users (id) on delete set null,
  role        text not null check (role in ('viewer', 'commenter', 'editor')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (doc_id, email)
);
create index if not exists collab_members_user_idx on public.collab_members (user_id);
create index if not exists collab_members_email_idx on public.collab_members (email);

-- Modifications (mises à jour Yjs), dans l'ordre d'arrivée
create table if not exists public.collab_updates (
  id          bigserial primary key,
  doc_id      uuid not null references public.collab_docs (id) on delete cascade,
  data        text not null check (char_length(data) between 1 and 12000000),
  author      uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists collab_updates_doc_idx on public.collab_updates (doc_id, id);

create table if not exists public.collab_comments (
  id          uuid primary key default gen_random_uuid(),
  doc_id      uuid not null references public.collab_docs (id) on delete cascade,
  parent      uuid references public.collab_comments (id) on delete cascade,
  author      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  anchor      jsonb check (anchor is null or pg_column_size(anchor) < 4000),
  body        text not null check (char_length(body) between 1 and 5000),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists collab_comments_doc_idx on public.collab_comments (doc_id, created_at);

-- ---------------------------------------------------------------- Rôles
-- Adresse e-mail CONFIRMÉE de l'utilisateur connecté (sinon null)
create or replace function public.lhe_my_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

-- Rôle de l'utilisateur connecté sur un document (null = aucun accès)
create or replace function public.lhe_doc_role(p_doc uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null or p_doc is null then null
    when exists (select 1 from public.collab_docs d where d.id = p_doc and d.owner = auth.uid()) then 'owner'
    else (select m.role from public.collab_members m
          where m.doc_id = p_doc and (m.user_id = auth.uid() or m.email = public.lhe_my_email())
          order by case m.role when 'editor' then 1 when 'commenter' then 2 else 3 end limit 1)
  end
$$;

-- Rôle d'après le nom d'un canal temps réel « doc:<uuid> »
create or replace function public.lhe_topic_role(p_topic text) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_topic is null or p_topic !~ '^doc:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  return public.lhe_doc_role(substr(p_topic, 5)::uuid);
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.collab_docs     enable row level security;
alter table public.collab_members  enable row level security;
alter table public.collab_updates  enable row level security;
alter table public.collab_comments enable row level security;

-- Pas d'accès sans compte ; accès minimal pour les comptes (le reste passe par les fonctions)
revoke all on public.profiles, public.collab_docs, public.collab_members, public.collab_updates, public.collab_comments from public, anon, authenticated;
revoke all on sequence public.collab_updates_id_seq from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (pseudo) on public.profiles to authenticated;
grant select, insert, delete on public.collab_docs to authenticated;
grant update (title) on public.collab_docs to authenticated;
grant select on public.collab_members to authenticated;
grant select, insert on public.collab_updates to authenticated;
grant usage on sequence public.collab_updates_id_seq to authenticated;
grant select, insert, delete on public.collab_comments to authenticated;

drop policy if exists "profil : soi" on public.profiles;
create policy "profil : soi" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profil : modifier le sien" on public.profiles;
create policy "profil : modifier le sien" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "docs : membres" on public.collab_docs;
-- (owner = auth.uid() d'abord : à la création, la fonction de rôle ne voit pas encore la nouvelle ligne)
create policy "docs : membres" on public.collab_docs for select to authenticated using (owner = auth.uid() or public.lhe_doc_role(id) is not null);
drop policy if exists "docs : créer" on public.collab_docs;
create policy "docs : créer" on public.collab_docs for insert to authenticated
  with check (owner = auth.uid() and (select count(*) from public.collab_docs d where d.owner = auth.uid()) < 500);
drop policy if exists "docs : renommer" on public.collab_docs;
create policy "docs : renommer" on public.collab_docs for update to authenticated
  using (public.lhe_doc_role(id) in ('owner', 'editor')) with check (public.lhe_doc_role(id) in ('owner', 'editor'));
drop policy if exists "docs : supprimer" on public.collab_docs;
create policy "docs : supprimer" on public.collab_docs for delete to authenticated using (owner = auth.uid());

drop policy if exists "membres : voir" on public.collab_members;
create policy "membres : voir" on public.collab_members for select to authenticated using (public.lhe_doc_role(doc_id) is not null);

drop policy if exists "maj : lire" on public.collab_updates;
create policy "maj : lire" on public.collab_updates for select to authenticated using (public.lhe_doc_role(doc_id) is not null);
drop policy if exists "maj : écrire" on public.collab_updates;
create policy "maj : écrire" on public.collab_updates for insert to authenticated
  with check (author = auth.uid() and public.lhe_doc_role(doc_id) in ('owner', 'editor'));

drop policy if exists "comm : lire" on public.collab_comments;
create policy "comm : lire" on public.collab_comments for select to authenticated using (public.lhe_doc_role(doc_id) is not null);
drop policy if exists "comm : écrire" on public.collab_comments;
create policy "comm : écrire" on public.collab_comments for insert to authenticated
  with check (author = auth.uid() and resolved = false
    and public.lhe_doc_role(doc_id) in ('owner', 'editor', 'commenter')
    and (parent is null or exists (select 1 from public.collab_comments p where p.id = parent and p.doc_id = collab_comments.doc_id)));
drop policy if exists "comm : supprimer" on public.collab_comments;
create policy "comm : supprimer" on public.collab_comments for delete to authenticated
  using (author = auth.uid() or public.lhe_doc_role(doc_id) = 'owner');

-- Date de dernière modification du document
create or replace function public.lhe_touch_doc() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.collab_docs set updated_at = now() where id = new.doc_id and updated_at < now() - interval '5 seconds';
  return new;
end $$;
drop trigger if exists lhe_touch_on_update on public.collab_updates;
create trigger lhe_touch_on_update after insert on public.collab_updates for each row execute function public.lhe_touch_doc();

-- ---------------------------------------------------------------- Fonctions
-- Mes documents (créés ou partagés avec moi). Rattache au passage les invitations
-- faites à mon adresse confirmée.
create or replace function public.lhe_my_docs()
returns table (id uuid, title text, role text, owner_pseudo text, is_owner boolean, updated_at timestamptz, created_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := public.lhe_my_email();
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  if v_email is not null then
    update public.collab_members m set user_id = auth.uid() where m.email = v_email and m.user_id is null;
  end if;
  return query
    select d.id, d.title, public.lhe_doc_role(d.id), coalesce(p.pseudo, ''), d.owner = auth.uid(), d.updated_at, d.created_at
    from public.collab_docs d
    left join public.profiles p on p.id = d.owner
    where d.owner = auth.uid()
       or exists (select 1 from public.collab_members m where m.doc_id = d.id and (m.user_id = auth.uid() or m.email = v_email))
    order by d.updated_at desc
    limit 300;
end $$;

-- Personnes ayant accès à un document (propriétaire + invités). Les adresses
-- e-mail ne sont montrées qu'au propriétaire et aux éditeurs.
create or replace function public.lhe_doc_people(p_doc uuid)
returns table (user_id uuid, email text, pseudo text, role text, pending boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_role text := public.lhe_doc_role(p_doc); v_see boolean;
begin
  if v_role is null then raise exception 'LHE_FORBIDDEN'; end if;
  v_see := v_role in ('owner', 'editor');
  return query
    select d.owner, case when v_see then lower(u.email) else null end, coalesce(p.pseudo, ''), 'owner'::text, false
      from public.collab_docs d join auth.users u on u.id = d.owner left join public.profiles p on p.id = d.owner
      where d.id = p_doc
    union all
    select m.user_id, case when v_see or m.user_id = auth.uid() then m.email else null end, coalesce(p.pseudo, ''), m.role, m.user_id is null
      from public.collab_members m left join public.profiles p on p.id = m.user_id
      where m.doc_id = p_doc;
end $$;

-- Inviter (ou changer le rôle d'une personne déjà invitée) — propriétaire seulement
create or replace function public.lhe_invite(p_doc uuid, p_email text, p_role text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_n int; v_new boolean; v_uid uuid;
begin
  if public.lhe_doc_role(p_doc) is distinct from 'owner' then raise exception 'LHE_FORBIDDEN'; end if;
  if p_role not in ('viewer', 'commenter', 'editor') then raise exception 'LHE_ROLE'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'LHE_EMAIL'; end if;
  if v_email = public.lhe_my_email() then raise exception 'LHE_SELF'; end if;
  select count(*) into v_n from public.collab_members where invited_by = auth.uid() and created_at > now() - interval '1 hour';
  if v_n >= 60 then raise exception 'LHE_RATE'; end if;
  select u.id into v_uid from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null;
  v_new := not exists (select 1 from public.collab_members where doc_id = p_doc and email = v_email);
  insert into public.collab_members (doc_id, email, role, invited_by, user_id)
    values (p_doc, v_email, p_role, auth.uid(), v_uid)
    on conflict (doc_id, email) do update set role = excluded.role;
  return json_build_object('email', v_email, 'role', p_role, 'new', v_new);
end $$;

-- E-mail d'invitation (fonction « send-invite ») : propriétaire seulement, un envoi
-- par personne toutes les 10 minutes au plus ; renvoie de quoi rédiger l'e-mail
alter table public.collab_members add column if not exists notified_at timestamptz;
create or replace function public.lhe_invite_info(p_doc uuid, p_email text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); m public.collab_members%rowtype; v_title text; v_from text;
begin
  if public.lhe_doc_role(p_doc) is distinct from 'owner' then raise exception 'LHE_FORBIDDEN'; end if;
  select * into m from public.collab_members where doc_id = p_doc and email = v_email;
  if not found then raise exception 'LHE_FORBIDDEN'; end if;
  if m.notified_at is not null and m.notified_at > now() - interval '10 minutes' then raise exception 'LHE_RATE'; end if;
  update public.collab_members set notified_at = now() where doc_id = p_doc and email = v_email;
  select d.title into v_title from public.collab_docs d where d.id = p_doc;
  select p.pseudo into v_from from public.profiles p where p.id = auth.uid();
  return json_build_object('email', v_email, 'role', m.role, 'title', coalesce(v_title, ''), 'from', coalesce(v_from, ''), 'doc', p_doc,
    'has_account', exists (select 1 from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null));
end $$;

-- Retirer une personne (le propriétaire, ou la personne elle-même qui quitte le document)
create or replace function public.lhe_remove_member(p_doc uuid, p_email text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if public.lhe_doc_role(p_doc) is distinct from 'owner'
     and not exists (select 1 from public.collab_members m where m.doc_id = p_doc and m.email = v_email
                     and (m.user_id = auth.uid() or m.email = public.lhe_my_email())) then
    raise exception 'LHE_FORBIDDEN';
  end if;
  delete from public.collab_members where doc_id = p_doc and email = v_email;
  return found;
end $$;

-- Infos d'un document pour l'ouvrir : titre, rôle, snapshot
create or replace function public.lhe_open_doc(p_doc uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare v_role text := public.lhe_doc_role(p_doc); r public.collab_docs%rowtype;
begin
  if v_role is null then raise exception 'LHE_FORBIDDEN'; end if;
  select * into r from public.collab_docs where id = p_doc;
  return json_build_object('id', r.id, 'title', r.title, 'role', v_role, 'owner', r.owner,
    'snapshot', r.snapshot, 'snapshot_upto', r.snapshot_upto, 'updated_at', r.updated_at);
end $$;

-- Compaction : un éditeur remplace les mises à jour déjà fusionnées par un état complet
create or replace function public.lhe_compact(p_doc uuid, p_snapshot text, p_upto bigint) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.lhe_doc_role(p_doc) not in ('owner', 'editor') then raise exception 'LHE_FORBIDDEN'; end if;
  if p_snapshot is null or char_length(p_snapshot) > 20000000 then raise exception 'LHE_SIZE'; end if;
  update public.collab_docs set snapshot = p_snapshot, snapshot_upto = p_upto
    where id = p_doc and snapshot_upto < p_upto
      and p_upto <= (select coalesce(max(u.id), 0) from public.collab_updates u where u.doc_id = p_doc);
  if not found then return false; end if;
  -- Marge d'une minute : une mise à jour encore en cours d'écriture n'est jamais effacée
  delete from public.collab_updates where doc_id = p_doc and id <= p_upto and created_at < now() - interval '1 minute';
  return true;
end $$;

-- Commentaires : modifier son texte (auteur) ou marquer résolu (auteur, éditeurs, propriétaire)
create or replace function public.lhe_comment_update(p_id uuid, p_body text default null, p_resolved boolean default null) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare c public.collab_comments%rowtype; v_role text;
begin
  select * into c from public.collab_comments where id = p_id;
  if not found then return false; end if;
  v_role := public.lhe_doc_role(c.doc_id);
  if v_role is null then raise exception 'LHE_FORBIDDEN'; end if;
  if p_body is not null then
    if c.author <> auth.uid() then raise exception 'LHE_FORBIDDEN'; end if;
    if char_length(p_body) not between 1 and 5000 then raise exception 'LHE_SIZE'; end if;
    update public.collab_comments set body = p_body, updated_at = now() where id = p_id;
  end if;
  if p_resolved is not null then
    if not (c.author = auth.uid() or v_role in ('owner', 'editor')) then raise exception 'LHE_FORBIDDEN'; end if;
    update public.collab_comments set resolved = p_resolved, updated_at = now() where id = p_id;
  end if;
  return true;
end $$;

-- Commentaires d'un document, avec le pseudo des auteurs
create or replace function public.lhe_comments(p_doc uuid)
returns table (id uuid, parent uuid, author uuid, pseudo text, anchor jsonb, body text, resolved boolean, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.lhe_doc_role(p_doc) is null then raise exception 'LHE_FORBIDDEN'; end if;
  return query select c.id, c.parent, c.author, coalesce(p.pseudo, ''), c.anchor, c.body, c.resolved, c.created_at, c.updated_at
    from public.collab_comments c left join public.profiles p on p.id = c.author
    where c.doc_id = p_doc order by c.created_at limit 2000;
end $$;

-- Supprimer son compte (et les documents dont on est propriétaire)
create or replace function public.lhe_delete_account() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := public.lhe_my_email();
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  if v_email is not null then delete from public.collab_members where email = v_email; end if;
  delete from auth.users where id = auth.uid();
  return true;
end $$;

-- Droits d'exécution : comptes connectés seulement
revoke all on function public.lhe_new_user() from public, anon, authenticated;
revoke all on function public.lhe_touch_doc() from public, anon, authenticated;
revoke all on function public.lhe_my_email() from public, anon;
revoke all on function public.lhe_doc_role(uuid) from public, anon;
revoke all on function public.lhe_topic_role(text) from public, anon;
revoke all on function public.lhe_my_docs() from public, anon;
revoke all on function public.lhe_doc_people(uuid) from public, anon;
revoke all on function public.lhe_invite(uuid, text, text) from public, anon;
revoke all on function public.lhe_remove_member(uuid, text) from public, anon;
revoke all on function public.lhe_invite_info(uuid, text) from public, anon;
revoke all on function public.lhe_open_doc(uuid) from public, anon;
revoke all on function public.lhe_compact(uuid, text, bigint) from public, anon;
revoke all on function public.lhe_comment_update(uuid, text, boolean) from public, anon;
revoke all on function public.lhe_comments(uuid) from public, anon;
revoke all on function public.lhe_delete_account() from public, anon;
grant execute on function public.lhe_my_email(), public.lhe_doc_role(uuid), public.lhe_topic_role(text),
  public.lhe_my_docs(), public.lhe_doc_people(uuid), public.lhe_invite(uuid, text, text),
  public.lhe_remove_member(uuid, text), public.lhe_invite_info(uuid, text), public.lhe_open_doc(uuid), public.lhe_compact(uuid, text, bigint),
  public.lhe_comment_update(uuid, text, boolean), public.lhe_comments(uuid), public.lhe_delete_account()
  to authenticated;

-- ---------------------------------------------------------------- Temps réel
-- Canaux privés « doc:<id> » : réception pour tous les membres ; diffusion des
-- modifications réservée au propriétaire et aux éditeurs ; présence pour tous.
drop policy if exists "lhe : recevoir" on realtime.messages;
create policy "lhe : recevoir" on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence') and public.lhe_topic_role(realtime.topic()) is not null);
drop policy if exists "lhe : diffuser" on realtime.messages;
create policy "lhe : diffuser" on realtime.messages for insert to authenticated
  with check (
    (realtime.messages.extension = 'broadcast' and public.lhe_topic_role(realtime.topic()) in ('owner', 'editor'))
    or (realtime.messages.extension = 'presence' and public.lhe_topic_role(realtime.topic()) is not null));

-- Changements de la base diffusés en direct (RLS appliquée à chaque destinataire)
do $$
declare t text;
begin
  foreach t in array array['collab_updates', 'collab_comments', 'collab_members'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;   -- déjà ajoutée
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
