-- ============================================================================
--  LaTeX Home Edition — notes des modules complémentaires (★ sur 5)
--  À coller dans Supabase : SQL Editor → New query → coller → Run.
--  Le script peut être relancé sans risque : il ne supprime aucune donnée et ne
--  touche à aucune autre table.
--
--  · Tout le monde (même sans compte) voit la moyenne et le nombre de notes ;
--  · seul un compte connecté peut noter, une seule note par module (modifiable,
--    ou retirée) ; personne ne voit qui a mis quelle note ;
--  · aucun accès direct à la table : lecture et écriture passent par les
--    fonctions ci-dessous, qui vérifient tout.
-- ============================================================================

create table if not exists public.lhe_module_ratings (
  module_id  text not null check (module_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (module_id, user_id)
);

alter table public.lhe_module_ratings enable row level security;
revoke all on public.lhe_module_ratings from public, anon, authenticated;

-- ---------------------------------------------------------------- Lecture
-- Moyenne, nombre de notes et répartition (1 à 5 étoiles) de chaque module
create or replace function public.lhe_module_stats()
returns table (module_id text, n integer, average numeric, s1 integer, s2 integer, s3 integer, s4 integer, s5 integer)
language sql stable security definer set search_path = '' as $$
  select r.module_id, count(*)::int, round(avg(r.stars), 2),
         (count(*) filter (where r.stars = 1))::int, (count(*) filter (where r.stars = 2))::int,
         (count(*) filter (where r.stars = 3))::int, (count(*) filter (where r.stars = 4))::int,
         (count(*) filter (where r.stars = 5))::int
    from public.lhe_module_ratings r
   group by r.module_id
$$;

-- Mes notes (compte connecté)
create or replace function public.lhe_module_my_ratings()
returns table (module_id text, stars smallint)
language sql stable security definer set search_path = '' as $$
  select r.module_id, r.stars from public.lhe_module_ratings r where r.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------- Écriture
-- Noter un module (1 à 5), ou retirer sa note (0 ou null)
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
  -- Limite par compte (aucun usage normal n'en approche)
  if not exists (select 1 from public.lhe_module_ratings r where r.module_id = p_module and r.user_id = auth.uid())
     and (select count(*) from public.lhe_module_ratings r where r.user_id = auth.uid()) >= 200 then
    raise exception 'LHE_RATE';
  end if;
  insert into public.lhe_module_ratings as r (module_id, user_id, stars, updated_at)
  values (p_module, auth.uid(), p_stars, now())
  on conflict (module_id, user_id) do update set stars = excluded.stars, updated_at = now();
end $$;

revoke all on function public.lhe_module_stats(), public.lhe_module_my_ratings(), public.lhe_module_rate(text, integer) from public;
grant execute on function public.lhe_module_stats() to anon, authenticated;
grant execute on function public.lhe_module_my_ratings(), public.lhe_module_rate(text, integer) to authenticated;
