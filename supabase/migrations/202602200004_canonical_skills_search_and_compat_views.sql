create extension if not exists pg_trgm;

alter table public.skills
  add column if not exists popularity_weight integer not null default 0,
  add column if not exists aliases text[] not null default '{}';

with merged_aliases as (
  select
    skill_id,
    array_agg(distinct alias order by alias) as aliases
  from (
    select canonical_skill_id as skill_id, alias
    from public.canonical_skill_aliases
    union all
    select skill_id, alias
    from public.skill_aliases
  ) rows
  group by skill_id
)
update public.skills s
set aliases = merged_aliases.aliases
from merged_aliases
where s.id = merged_aliases.skill_id
  and (s.aliases is null or cardinality(s.aliases) = 0);

create index if not exists skills_active_popularity_idx
  on public.skills (is_active, popularity_weight desc, label);

do $$
declare
  trgm_opclass text;
begin
  select quote_ident(n.nspname) || '.gin_trgm_ops'
  into trgm_opclass
  from pg_opclass oc
  join pg_namespace n on n.oid = oc.opcnamespace
  join pg_am am on am.oid = oc.opcmethod
  where oc.opcname = 'gin_trgm_ops'
    and am.amname = 'gin'
  limit 1;

  if trgm_opclass is null then
    raise notice 'gin_trgm_ops opclass not found; skipping trigram index creation for skills search';
    return;
  end if;

  execute format(
    'create index if not exists skills_label_trgm_idx on public.skills using gin (label %s)',
    trgm_opclass
  );
  execute format(
    'create index if not exists canonical_skill_aliases_alias_trgm_idx on public.canonical_skill_aliases using gin (alias %s)',
    trgm_opclass
  );
  execute format(
    'create index if not exists skill_aliases_alias_trgm_idx on public.skill_aliases using gin (alias %s)',
    trgm_opclass
  );
end
$$;

create or replace view public.canonical_skills as
select
  s.id,
  s.label as name,
  s.slug,
  coalesce(s.category, 'General') as category,
  coalesce(s.aliases, '{}') as aliases,
  coalesce(s.popularity_weight, 0) as popularity_weight,
  s.is_active,
  s.created_at
from public.skills s;

create or replace view public.internship_required_skills as
select
  r.internship_id,
  r.canonical_skill_id as skill_id,
  initcap(r.importance) as level,
  1::integer as weight
from public.internship_skill_requirements r
where r.canonical_skill_id is not null;

create or replace view public.internship_custom_skills as
select
  r.id,
  r.internship_id,
  c.name,
  r.created_at
from public.internship_skill_requirements r
join public.custom_skills c
  on c.id = r.custom_skill_id
where r.custom_skill_id is not null;
