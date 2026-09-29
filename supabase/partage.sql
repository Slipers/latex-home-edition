-- ============================================================================
--  LaTeX Home Edition — liens de partage (courts, uniques, mis à jour en direct)
--  À coller dans Supabase : SQL Editor → New query → coller → Run.
--  Le script peut être relancé sans risque : il met la base à jour sans
--  supprimer aucun partage existant.
--
--  Principe : l'application dépose le document (déjà compressé) et reçoit un
--  identifiant court (10 caractères) — un seul lien par document. L'auteur
--  peut ensuite envoyer de nouvelles versions sur le même lien (en direct ou
--  à la demande) ; ceux qui ont importé une copie voient qu'une version plus
--  récente existe. Personne ne peut lister les documents : la table n'est
--  accessible qu'au travers des fonctions ci-dessous, et on ne lit un
--  document qu'en connaissant son identifiant.
-- ============================================================================

create table if not exists public.shares (
  id          text primary key,
  payload     text not null,                     -- document compressé (base64url)
  title       text not null default '',          -- titre affiché sur la page du lien
  owner_hash  text not null,                     -- empreinte du code qui permet de modifier / désactiver le lien
  ip_hash     text,                              -- empreinte de l'adresse IP (limite anti-abus), effacée après 24 h
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '1 year'
);
-- Versions (ajoutées après coup : sans effet si elles existent déjà)
alter table public.shares add column if not exists version    int         not null default 1;
alter table public.shares add column if not exists updated_at timestamptz not null default now();
alter table public.shares add column if not exists live       boolean     not null default false;

create index if not exists shares_ip_idx on public.shares (ip_hash, created_at);
create index if not exists shares_exp_idx on public.shares (expires_at);

-- Aucun accès direct à la table depuis l'application : uniquement via les fonctions
alter table public.shares enable row level security;
revoke all on public.shares from public, anon, authenticated;

-- Identifiant aléatoire lisible (sans 0/O, 1/l/I)
create or replace function public.lhe_rand(n int) returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', (get_byte(x.b, i) % 57) + 1, 1), '')
  from (select extensions.gen_random_bytes(n) as b) x, generate_series(0, n - 1) i
$$;

-- Vérifications communes du contenu envoyé
create or replace function public.lhe_check_payload(p_payload text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_payload is null or length(p_payload) < 10 or length(p_payload) > 8000000 then raise exception 'LHE_SIZE'; end if;
  if p_payload !~ '^[A-Za-z0-9_-]+$' then raise exception 'LHE_FORMAT'; end if;
end $$;

-- Créer un partage → { id, token, version, updated_at, expires_at }
drop function if exists public.create_share(text, text);   -- ancienne version (sans p_live)
create or replace function public.create_share(p_payload text, p_title text default '', p_live boolean default false) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_h json := coalesce(current_setting('request.headers', true), '{}')::json;
  v_ip text; v_n int; v_id text; v_token text; v_now timestamptz := now();
begin
  perform public.lhe_check_payload(p_payload);

  -- Limite anti-abus : 30 liens par heure et par adresse IP (seule une empreinte est gardée)
  v_ip := coalesce(v_h->>'cf-connecting-ip', nullif(split_part(coalesce(v_h->>'x-forwarded-for', ''), ',', 1), ''), 'inconnue');
  v_ip := encode(extensions.digest(v_ip || '|lhe-share', 'sha256'), 'hex');
  select count(*) into v_n from public.shares where ip_hash = v_ip and created_at > v_now - interval '1 hour';
  if v_n >= 30 then raise exception 'LHE_RATE'; end if;

  -- Garde-fou pour l'offre gratuite de Supabase (500 Mo)
  if pg_total_relation_size('public.shares') > 400 * 1024 * 1024 then raise exception 'LHE_FULL'; end if;

  -- Ménage au fil de l'eau : partages expirés, empreintes IP de plus de 24 h
  delete from public.shares where id in (select s.id from public.shares s where s.expires_at < v_now limit 50);
  update public.shares set ip_hash = null
    where id in (select s.id from public.shares s where s.ip_hash is not null and s.created_at < v_now - interval '1 day' limit 200);

  loop
    v_id := public.lhe_rand(10);
    exit when not exists (select 1 from public.shares where id = v_id);
  end loop;
  v_token := public.lhe_rand(24);
  insert into public.shares (id, payload, title, owner_hash, ip_hash, live, version, updated_at)
    values (v_id, p_payload, left(coalesce(p_title, ''), 200), encode(extensions.digest(v_token, 'sha256'), 'hex'), v_ip, coalesce(p_live, false), 1, v_now);
  return json_build_object('id', v_id, 'token', v_token, 'version', 1, 'updated_at', v_now, 'expires_at', v_now + interval '1 year');
end $$;

-- Envoyer une nouvelle version sur le même lien (auteur seulement) → { version, updated_at, expires_at }
-- p_payload null = ne change que le mode (direct / figé), sans nouvelle version
create or replace function public.update_share(p_id text, p_token text, p_payload text default null, p_title text default null, p_live boolean default null) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare r public.shares%rowtype; v_now timestamptz := now();
begin
  select * into r from public.shares
    where id = p_id and owner_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and expires_at > v_now
    for update;
  if not found then raise exception 'LHE_NOTFOUND'; end if;
  if p_payload is not null then
    perform public.lhe_check_payload(p_payload);
    if r.updated_at > v_now - interval '2 seconds' then raise exception 'LHE_RATE'; end if;
    update public.shares set payload = p_payload, title = left(coalesce(p_title, r.title), 200),
      live = coalesce(p_live, r.live), version = r.version + 1, updated_at = v_now,
      expires_at = greatest(r.expires_at, v_now + interval '1 year')   -- un partage mis à jour n'expire pas
      where id = p_id
      returning * into r;
  elsif p_live is not null or p_title is not null then
    update public.shares set live = coalesce(p_live, r.live), title = left(coalesce(p_title, r.title), 200)
      where id = p_id returning * into r;
  end if;
  return json_build_object('version', r.version, 'updated_at', r.updated_at, 'expires_at', r.expires_at, 'live', r.live);
end $$;

-- Lire un partage (document complet) → null s'il n'existe pas, a expiré ou a été désactivé
create or replace function public.get_share(p_id text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('payload', s.payload, 'title', s.title, 'created_at', s.created_at, 'expires_at', s.expires_at,
    'version', s.version, 'updated_at', s.updated_at, 'live', s.live)
  from public.shares s where s.id = p_id and s.expires_at > now()
$$;

-- Infos légères (page web du lien, vérification des mises à jour) sans télécharger le document
create or replace function public.share_info(p_id text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('title', s.title, 'created_at', s.created_at, 'size', length(s.payload),
    'version', s.version, 'updated_at', s.updated_at, 'live', s.live)
  from public.shares s where s.id = p_id and s.expires_at > now()
$$;

-- Désactiver un lien (seul celui qui l'a créé a le code)
create or replace function public.delete_share(p_id text, p_token text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.shares where id = p_id and owner_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return found;
end $$;

-- Droits : l'application (clé publique) n'a accès qu'aux fonctions publiques
revoke all on function public.lhe_rand(int) from public, anon, authenticated;
revoke all on function public.lhe_check_payload(text) from public, anon, authenticated;
revoke all on function public.create_share(text, text, boolean) from public;
revoke all on function public.update_share(text, text, text, text, boolean) from public;
revoke all on function public.get_share(text) from public;
revoke all on function public.share_info(text) from public;
revoke all on function public.delete_share(text, text) from public;
grant execute on function public.create_share(text, text, boolean) to anon, authenticated;
grant execute on function public.update_share(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.get_share(text) to anon, authenticated;
grant execute on function public.share_info(text) to anon, authenticated;
grant execute on function public.delete_share(text, text) to anon, authenticated;

-- Recharge le schéma de l'API pour que les fonctions soient visibles tout de suite
notify pgrst, 'reload schema';
