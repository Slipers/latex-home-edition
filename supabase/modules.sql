-- ============================================================================
--  LaTeX Home Edition — modules complémentaires : installations et notes (★ sur 5)
--  À coller dans Supabase : SQL Editor → New query → coller → Run.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée et ne
--  touche à aucune autre table.
--
--  · Installer un module demande un compte : chaque compte enregistre ici les
--    modules qu'il a installés et combien de fois il s'en est servi ;
--  · tout le monde (même sans compte) voit la moyenne, le nombre de notes et le
--    nombre d'installations ;
--  · seul un compte qui a installé le module et s'en est servi au moins 3 fois
--    peut le noter, une seule note par module (modifiable, ou retirée) ;
--    personne ne voit qui a mis quelle note ;
--  · aucun accès direct aux tables : lecture et écriture passent par les
--    fonctions ci-dessous, qui vérifient tout.
-- ============================================================================

create table if not exists public.lhe_module_ratings (
  module_id  text not null check (module_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (module_id, user_id)
);

-- Modules installés par chaque compte, et nombre d'utilisations (exécutions…)
create table if not exists public.lhe_module_usage (
  module_id    text not null check (module_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  installed    boolean not null default true,
  uses         integer not null default 0 check (uses between 0 and 1000000),
  installed_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (module_id, user_id)
);

alter table public.lhe_module_ratings enable row level security;
alter table public.lhe_module_usage enable row level security;
revoke all on public.lhe_module_ratings from public, anon, authenticated;
revoke all on public.lhe_module_usage from public, anon, authenticated;

-- Fonctions dont la forme a changé depuis la première version du script
drop function if exists public.lhe_module_stats();
drop function if exists public.lhe_module_my_ratings();

-- ---------------------------------------------------------------- Lecture
-- Pour chaque module : nombre de notes, moyenne, répartition (1 à 5 étoiles)
-- et nombre de comptes qui l'ont installé
create or replace function public.lhe_module_stats()
returns table (module_id text, n integer, average numeric, s1 integer, s2 integer, s3 integer, s4 integer, s5 integer, installs integer)
language sql stable security definer set search_path = '' as $$
  with ids as (
    select r.module_id from public.lhe_module_ratings r
    union
    select u.module_id from public.lhe_module_usage u where u.installed
  )
  select i.module_id,
         (select count(*) from public.lhe_module_ratings r where r.module_id = i.module_id)::int,
         (select round(avg(r.stars), 2) from public.lhe_module_ratings r where r.module_id = i.module_id),
         (select count(*) from public.lhe_module_ratings r where r.module_id = i.module_id and r.stars = 1)::int,
         (select count(*) from public.lhe_module_ratings r where r.module_id = i.module_id and r.stars = 2)::int,
         (select count(*) from public.lhe_module_ratings r where r.module_id = i.module_id and r.stars = 3)::int,
         (select count(*) from public.lhe_module_ratings r where r.module_id = i.module_id and r.stars = 4)::int,
         (select count(*) from public.lhe_module_ratings r where r.module_id = i.module_id and r.stars = 5)::int,
         (select count(*) from public.lhe_module_usage u where u.module_id = i.module_id and u.installed)::int
    from ids i
$$;

-- Mes modules (compte connecté) : installé ou non, utilisations, ma note
create or replace function public.lhe_module_mine()
returns table (module_id text, installed boolean, uses integer, stars smallint)
language sql stable security definer set search_path = '' as $$
  select coalesce(u.module_id, r.module_id), coalesce(u.installed, false), coalesce(u.uses, 0), r.stars
    from (select * from public.lhe_module_usage where user_id = auth.uid()) u
    full join (select * from public.lhe_module_ratings where user_id = auth.uid()) r on r.module_id = u.module_id
$$;

-- ---------------------------------------------------------------- Écriture
-- Installation, désinstallation et utilisations d'un module (le compteur ne
-- fait que monter : on garde le plus grand nombre reçu)
create or replace function public.lhe_module_track(p_module text, p_installed boolean, p_uses integer)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  if p_module is null or p_module !~ '^[a-z0-9][a-z0-9-]{0,39}$' then raise exception 'LHE_MODULE'; end if;
  -- Limite par compte (aucun usage normal n'en approche)
  if not exists (select 1 from public.lhe_module_usage u where u.module_id = p_module and u.user_id = auth.uid())
     and (select count(*) from public.lhe_module_usage u where u.user_id = auth.uid()) >= 200 then
    raise exception 'LHE_RATE';
  end if;
  insert into public.lhe_module_usage as u (module_id, user_id, installed, uses, installed_at, updated_at)
  values (p_module, auth.uid(), coalesce(p_installed, true), greatest(0, least(coalesce(p_uses, 0), 1000000)), now(), now())
  on conflict (module_id, user_id) do update set
    installed    = coalesce(p_installed, u.installed),
    uses         = greatest(u.uses, least(coalesce(p_uses, 0), 1000000)),
    installed_at = case when p_installed and not u.installed then now() else u.installed_at end,
    updated_at   = now();
end $$;

-- Noter un module (1 à 5), ou retirer sa note (0 ou null). Pour noter, il faut
-- avoir installé le module et s'en être servi au moins 3 fois.
create or replace function public.lhe_module_rate(p_module text, p_stars integer)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'LHE_AUTH'; end if;
  if p_module is null or p_module !~ '^[a-z0-9][a-z0-9-]{0,39}$' then raise exception 'LHE_MODULE'; end if;
  if p_stars is null or p_stars = 0 then
    delete from public.lhe_module_ratings r where r.module_id = p_module and r.user_id = auth.uid();
    return;
  end if;
  if p_stars not between 1 and 5 then raise exception 'LHE_STARS'; end if;
  if not exists (select 1 from public.lhe_module_usage u where u.module_id = p_module and u.user_id = auth.uid() and u.uses >= 3) then
    raise exception 'LHE_USE';
  end if;
  insert into public.lhe_module_ratings as r (module_id, user_id, stars, updated_at)
  values (p_module, auth.uid(), p_stars, now())
  on conflict (module_id, user_id) do update set stars = excluded.stars, updated_at = now();
end $$;

revoke all on function public.lhe_module_stats(), public.lhe_module_mine(), public.lhe_module_track(text, boolean, integer), public.lhe_module_rate(text, integer) from public;
grant execute on function public.lhe_module_stats() to anon, authenticated;
grant execute on function public.lhe_module_mine(), public.lhe_module_track(text, boolean, integer), public.lhe_module_rate(text, integer) to authenticated;
