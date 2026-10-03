-- ============================================================================
--  LaTeX Home Edition — « Mes fichiers en ligne »
--  À coller dans Supabase : SQL Editor → New query → coller → Run.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée et ne
--  touche pas aux tables de la Live Modification ni des liens de partage.
--
--  Chaque compte a son propre espace de fichiers, PRIVÉ : la sécurité au
--  niveau des lignes (RLS) ne laisse lire un fichier qu'à son propriétaire, et
--  toutes les écritures passent par les fonctions ci-dessous, qui vérifient
--  le propriétaire. Personne d'autre (ni les autres comptes, ni les visiteurs
--  sans compte) ne peut lister, lire, modifier ou supprimer vos fichiers.
--
--  Rien n'est détruit par erreur :
--    · un enregistrement depuis un autre ordinateur ne peut pas écraser sans le
--      savoir une version plus récente (numéro de version vérifié) ;
--    · la version précédente d'un fichier est gardée et peut être rétablie ;
--    · « Supprimer » met à la corbeille (vidée automatiquement après 30 jours) ;
--      seule la suppression depuis la corbeille est définitive ;
--    · un nouveau fichier ne remplace jamais un fichier du même nom : il est
--      renommé « nom (2) », « nom (3) »…
-- ============================================================================

create table if not exists public.lhe_files (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  data        text not null check (char_length(data) between 1 and 15000000),   -- document compressé
  size        integer not null default 0,
  version     integer not null default 1,
  prev_data   text check (prev_data is null or char_length(prev_data) <= 15000000), -- version précédente
  prev_at     timestamptz,
  deleted_at  timestamptz,                                                         -- corbeille
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lhe_files_owner_idx on public.lhe_files (owner, updated_at desc);

alter table public.lhe_files enable row level security;
revoke all on public.lhe_files from public, anon, authenticated;
grant select on public.lhe_files to authenticated;   -- lecture de SES fichiers seulement (règle ci-dessous)
drop policy if exists "fichiers : les siens" on public.lhe_files;
create policy "fichiers : les siens" on public.lhe_files for select to authenticated using (owner = auth.uid());

-- ---------------------------------------------------------------- Limites
-- Par compte : 500 fichiers et 60 millions de caractères (≈ 45 Mo), versions
-- précédentes et corbeille comprises — de quoi garder l'offre gratuite de
-- Supabase utilisable par plusieurs personnes.
create or replace function public.lhe_files_quota(p_except uuid, p_add bigint) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v_used bigint;
begin
  select coalesce(sum(char_length(f.data) + coalesce(char_length(f.prev_data), 0)), 0) into v_used
    from public.lhe_files f where f.owner = auth.uid() and f.id is distinct from p_except;
  if v_used + p_add > 60000000 then raise exception 'LHE_QUOTA'; end if;
end $$;

-- Nom libre parmi les fichiers (hors corbeille) : « nom », sinon « nom (2) »…
create or replace function public.lhe_files_free_name(p_name text, p_except uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_base text := left(coalesce(nullif(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), ''), 'Sans titre'), 190);
  v_name text := v_base;
  n int := 1;
begin
  while exists (select 1 from public.lhe_files f
                where f.owner = auth.uid() and f.deleted_at is null and lower(f.name) = lower(v_name) and f.id is distinct from p_except) loop
    n := n + 1;
    v_name := v_base || ' (' || n || ')';
  end loop;
  return v_name;
end $$;

-- ---------------------------------------------------------------- Liste
-- Mes fichiers (sans leur contenu), corbeille comprise ; la corbeille de plus
-- de 30 jours est vidée au passage.
create or replace function public.lhe_my_files()
returns table (id uuid, name text, size integer, version integer, updated_at timestamptz, created_at timestamptz, deleted_at timestamptz, prev_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  delete from public.lhe_files f where f.owner = auth.uid() and f.deleted_at < now() - interval '30 days';
  return query
    select f.id, f.name, f.size, f.version, f.updated_at, f.created_at, f.deleted_at, f.prev_at
    from public.lhe_files f where f.owner = auth.uid()
    order by f.updated_at desc;
end $$;

create or replace function public.lhe_files_usage() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'used', coalesce(sum(char_length(f.data) + coalesce(char_length(f.prev_data), 0)), 0),
    'max', 60000000,
    'count', count(*))
  from public.lhe_files f where f.owner = auth.uid()
$$;

-- ---------------------------------------------------------------- Enregistrer
-- p_id null : nouveau fichier. Sinon : nouvelle version du fichier p_id, refusée
-- (LHE_CONFLICT) si le fichier a changé depuis la version p_version — sauf
-- p_force, et alors la version remplacée est gardée comme version précédente.
create or replace function public.lhe_file_save(p_id uuid, p_name text, p_data text, p_version integer, p_force boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare r public.lhe_files%rowtype; v_rotate boolean;
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  if p_data is null or char_length(p_data) < 1 or char_length(p_data) > 15000000 then raise exception 'LHE_SIZE'; end if;
  if p_id is null then
    if (select count(*) from public.lhe_files f where f.owner = auth.uid()) >= 500 then raise exception 'LHE_QUOTA'; end if;
    perform public.lhe_files_quota(null, char_length(p_data));
    insert into public.lhe_files (owner, name, data, size)
      values (auth.uid(), public.lhe_files_free_name(p_name, null), p_data, char_length(p_data))
      returning * into r;
  else
    select * into r from public.lhe_files f where f.id = p_id and f.owner = auth.uid() for update;
    if not found then raise exception 'LHE_GONE'; end if;
    if r.deleted_at is not null then raise exception 'LHE_TRASHED'; end if;
    if r.version <> coalesce(p_version, -1) and not coalesce(p_force, false) then raise exception 'LHE_CONFLICT'; end if;
    -- Version précédente : celle d'avant la séance de travail en cours (au moins
    -- 10 minutes d'écart), ou celle qu'on écrase en forçant
    v_rotate := coalesce(p_force, false) or r.prev_data is null or r.updated_at < now() - interval '10 minutes';
    perform public.lhe_files_quota(r.id, char_length(p_data) + case when v_rotate then char_length(r.data) else coalesce(char_length(r.prev_data), 0) end);
    update public.lhe_files f set
      data = p_data, size = char_length(p_data), version = r.version + 1, updated_at = now(),
      prev_data = case when v_rotate then r.data else f.prev_data end,
      prev_at = case when v_rotate then r.updated_at else f.prev_at end
    where f.id = r.id
    returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'name', r.name, 'version', r.version, 'updated_at', r.updated_at);
end $$;

-- ---------------------------------------------------------------- Gérer
create or replace function public.lhe_file_rename(p_id uuid, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  if not exists (select 1 from public.lhe_files f where f.id = p_id and f.owner = auth.uid()) then raise exception 'LHE_GONE'; end if;
  v_name := public.lhe_files_free_name(p_name, p_id);
  update public.lhe_files f set name = v_name where f.id = p_id and f.owner = auth.uid();
  return jsonb_build_object('id', p_id, 'name', v_name);
end $$;

-- Corbeille : on met de côté, on restaure, ou on supprime définitivement
-- (seulement depuis la corbeille)
create or replace function public.lhe_file_trash(p_id uuid, p_trash boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  if not exists (select 1 from public.lhe_files f where f.id = p_id and f.owner = auth.uid()) then raise exception 'LHE_GONE'; end if;
  if p_trash then
    update public.lhe_files f set deleted_at = coalesce(f.deleted_at, now()) where f.id = p_id and f.owner = auth.uid();
  else
    -- Un fichier du même nom a pu être créé entre-temps : le restauré change de nom
    select public.lhe_files_free_name(f.name, p_id) into v_name from public.lhe_files f where f.id = p_id;
    update public.lhe_files f set deleted_at = null, name = v_name where f.id = p_id and f.owner = auth.uid();
  end if;
  return (select jsonb_build_object('id', f.id, 'name', f.name, 'deleted_at', f.deleted_at) from public.lhe_files f where f.id = p_id);
end $$;

create or replace function public.lhe_file_purge(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  delete from public.lhe_files f where f.id = p_id and f.owner = auth.uid() and f.deleted_at is not null;
  if not found then raise exception 'LHE_NOT_TRASHED'; end if;
  return true;
end $$;

-- Rétablit la version précédente ; la version actuelle devient la « précédente »
-- (on peut donc revenir en arrière sans rien perdre)
create or replace function public.lhe_file_revert(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare r public.lhe_files%rowtype;
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  select * into r from public.lhe_files f where f.id = p_id and f.owner = auth.uid() for update;
  if not found then raise exception 'LHE_GONE'; end if;
  if r.prev_data is null then raise exception 'LHE_NO_PREV'; end if;
  update public.lhe_files f set
    data = r.prev_data, size = char_length(r.prev_data), prev_data = r.data, prev_at = r.updated_at,
    version = r.version + 1, updated_at = now()
  where f.id = r.id returning * into r;
  return jsonb_build_object('id', r.id, 'name', r.name, 'version', r.version, 'updated_at', r.updated_at);
end $$;

-- ---------------------------------------------------------------- Droits
revoke all on function public.lhe_files_quota(uuid, bigint) from public, anon, authenticated;
revoke all on function public.lhe_files_free_name(text, uuid) from public, anon, authenticated;
revoke all on function public.lhe_my_files() from public, anon;
revoke all on function public.lhe_files_usage() from public, anon;
revoke all on function public.lhe_file_save(uuid, text, text, integer, boolean) from public, anon;
revoke all on function public.lhe_file_rename(uuid, text) from public, anon;
revoke all on function public.lhe_file_trash(uuid, boolean) from public, anon;
revoke all on function public.lhe_file_purge(uuid) from public, anon;
revoke all on function public.lhe_file_revert(uuid) from public, anon;
grant execute on function public.lhe_my_files(), public.lhe_files_usage(),
  public.lhe_file_save(uuid, text, text, integer, boolean), public.lhe_file_rename(uuid, text),
  public.lhe_file_trash(uuid, boolean), public.lhe_file_purge(uuid), public.lhe_file_revert(uuid)
  to authenticated;
