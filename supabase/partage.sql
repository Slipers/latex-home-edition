-- ============================================================================
--  LaTeX Home Edition — liens de partage courts
--  À coller dans Supabase : SQL Editor → New query → coller → Run.
--  Le script peut être relancé sans risque (il ne supprime aucun partage).
--
--  Principe : l'application dépose le document (déjà compressé) et reçoit un
--  identifiant court (10 caractères). Personne ne peut lister les documents :
--  la table n'est accessible qu'au travers des quatre fonctions ci-dessous,
--  et on ne lit un document qu'en connaissant son identifiant.
-- ============================================================================

create table if not exists public.shares (
  id          text primary key,
  payload     text not null,                     -- document compressé (base64url)
  title       text not null default '',          -- titre affiché sur la page du lien
  owner_hash  text not null,                     -- empreinte du code qui permet de désactiver le lien
  ip_hash     text,                              -- empreinte de l'adresse IP (limite anti-abus), effacée après 24 h
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '1 year'
);
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

-- Créer un partage → { id, token, expires_at }
create or replace function public.create_share(p_payload text, p_title text default '') returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_h json := coalesce(current_setting('request.headers', true), '{}')::json;
  v_ip text; v_n int; v_id text; v_token text;
begin
  if p_payload is null or length(p_payload) < 10 or length(p_payload) > 8000000 then
    raise exception 'LHE_SIZE';
  end if;
  if p_payload !~ '^[A-Za-z0-9_-]+$' then raise exception 'LHE_FORMAT'; end if;

  -- Limite anti-abus : 30 liens par heure et par adresse IP (seule une empreinte est gardée)
  v_ip := coalesce(v_h->>'cf-connecting-ip', nullif(split_part(coalesce(v_h->>'x-forwarded-for', ''), ',', 1), ''), 'inconnue');
  v_ip := encode(extensions.digest(v_ip || '|lhe-share', 'sha256'), 'hex');
  select count(*) into v_n from public.shares where ip_hash = v_ip and created_at > now() - interval '1 hour';
  if v_n >= 30 then raise exception 'LHE_RATE'; end if;

  -- Garde-fou pour l'offre gratuite de Supabase (500 Mo)
  if pg_total_relation_size('public.shares') > 400 * 1024 * 1024 then raise exception 'LHE_FULL'; end if;

  -- Ménage au fil de l'eau : partages expirés, empreintes IP de plus de 24 h
  delete from public.shares where id in (select s.id from public.shares s where s.expires_at < now() limit 50);
  update public.shares set ip_hash = null
    where id in (select s.id from public.shares s where s.ip_hash is not null and s.created_at < now() - interval '1 day' limit 200);

  loop
    v_id := public.lhe_rand(10);
    exit when not exists (select 1 from public.shares where id = v_id);
  end loop;
  v_token := public.lhe_rand(24);
  insert into public.shares (id, payload, title, owner_hash, ip_hash)
    values (v_id, p_payload, left(coalesce(p_title, ''), 200), encode(extensions.digest(v_token, 'sha256'), 'hex'), v_ip);
  return json_build_object('id', v_id, 'token', v_token, 'expires_at', now() + interval '1 year');
end $$;

-- Lire un partage (document complet) → null s'il n'existe pas, a expiré ou a été désactivé
create or replace function public.get_share(p_id text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('payload', s.payload, 'title', s.title, 'created_at', s.created_at, 'expires_at', s.expires_at)
  from public.shares s where s.id = p_id and s.expires_at > now()
$$;

-- Infos légères pour la page web du lien (sans télécharger le document)
create or replace function public.share_info(p_id text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('title', s.title, 'created_at', s.created_at, 'size', length(s.payload))
  from public.shares s where s.id = p_id and s.expires_at > now()
$$;

-- Désactiver un lien (seul celui qui l'a créé a le code)
create or replace function public.delete_share(p_id text, p_token text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.shares where id = p_id and owner_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return found;
end $$;

-- Droits : l'application (clé publique) n'a accès qu'aux quatre fonctions
revoke all on function public.lhe_rand(int) from public, anon, authenticated;
revoke all on function public.create_share(text, text) from public;
revoke all on function public.get_share(text) from public;
revoke all on function public.share_info(text) from public;
revoke all on function public.delete_share(text, text) from public;
grant execute on function public.create_share(text, text) to anon, authenticated;
grant execute on function public.get_share(text) to anon, authenticated;
grant execute on function public.share_info(text) to anon, authenticated;
grant execute on function public.delete_share(text, text) to anon, authenticated;

-- Recharge le schéma de l'API pour que les fonctions soient visibles tout de suite
notify pgrst, 'reload schema';
