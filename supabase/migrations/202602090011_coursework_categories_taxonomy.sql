create extension if not exists pg_trgm;

create table if not exists public.coursework_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.coursework_item_category_map (
  coursework_item_id uuid not null references public.coursework_items(id) on delete cascade,
  category_id uuid not null references public.coursework_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coursework_item_id, category_id)
);

create table if not exists public.student_coursework_category_links (
  student_id uuid not null references public.users(id) on delete cascade,
  category_id uuid not null references public.coursework_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, category_id)
);

create table if not exists public.internship_coursework_category_links (
  internship_id uuid not null references public.internships(id) on delete cascade,
  category_id uuid not null references public.coursework_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (internship_id, category_id)
);

create index if not exists coursework_categories_name_trgm_idx
  on public.coursework_categories using gin (name gin_trgm_ops);
create index if not exists coursework_items_name_trgm_idx
  on public.coursework_items using gin (name gin_trgm_ops);
create index if not exists coursework_item_category_map_category_idx
  on public.coursework_item_category_map(category_id);
create index if not exists student_coursework_category_links_category_idx
  on public.student_coursework_category_links(category_id);
create index if not exists internship_coursework_category_links_category_idx
  on public.internship_coursework_category_links(category_id);

create or replace function public.is_admin_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role in ('ops_admin', 'super_admin')
  );
$$;

alter table public.coursework_categories enable row level security;
alter table public.coursework_item_category_map enable row level security;
alter table public.student_coursework_category_links enable row level security;
alter table public.internship_coursework_category_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='coursework_categories' and policyname='coursework_categories_select_public'
  ) then
    create policy coursework_categories_select_public
      on public.coursework_categories
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='coursework_categories' and policyname='coursework_categories_manage_admin'
  ) then
    create policy coursework_categories_manage_admin
      on public.coursework_categories
      for all
      to authenticated
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='coursework_item_category_map' and policyname='coursework_item_category_map_select_public'
  ) then
    create policy coursework_item_category_map_select_public
      on public.coursework_item_category_map
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='coursework_item_category_map' and policyname='coursework_item_category_map_manage_admin'
  ) then
    create policy coursework_item_category_map_manage_admin
      on public.coursework_item_category_map
      for all
      to authenticated
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='student_coursework_category_links' and policyname='student_coursework_category_links_select_own'
  ) then
    create policy student_coursework_category_links_select_own
      on public.student_coursework_category_links
      for select
      to authenticated
      using (student_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='student_coursework_category_links' and policyname='student_coursework_category_links_insert_own'
  ) then
    create policy student_coursework_category_links_insert_own
      on public.student_coursework_category_links
      for insert
      to authenticated
      with check (student_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='student_coursework_category_links' and policyname='student_coursework_category_links_delete_own'
  ) then
    create policy student_coursework_category_links_delete_own
      on public.student_coursework_category_links
      for delete
      to authenticated
      using (student_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='internship_coursework_category_links' and policyname='internship_coursework_category_links_select_public'
  ) then
    create policy internship_coursework_category_links_select_public
      on public.internship_coursework_category_links
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='internship_coursework_category_links' and policyname='internship_coursework_category_links_insert_employer'
  ) then
    create policy internship_coursework_category_links_insert_employer
      on public.internship_coursework_category_links
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.internships i
          where i.id = internship_coursework_category_links.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='internship_coursework_category_links' and policyname='internship_coursework_category_links_delete_employer'
  ) then
    create policy internship_coursework_category_links_delete_employer
      on public.internship_coursework_category_links
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.internships i
          where i.id = internship_coursework_category_links.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='internship_coursework_category_links' and policyname='internship_coursework_category_links_manage_admin'
  ) then
    create policy internship_coursework_category_links_manage_admin
      on public.internship_coursework_category_links
      for all
      to authenticated
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;

insert into public.coursework_categories (name, normalized_name)
values
  ('Corporate Finance / Valuation', 'corporatefinancevaluation'),
  ('Financial Accounting', 'financialaccounting'),
  ('Managerial Accounting', 'managerialaccounting'),
  ('Financial Modeling (Excel)', 'financialmodelingexcel'),
  ('Investments / Portfolio Theory', 'investmentsportfoliotheory'),
  ('Statistics / Probability', 'statisticsprobability'),
  ('Econometrics / Regression', 'econometricsregression'),
  ('SQL / Databases', 'sqldatabases'),
  ('Data Visualization (Tableau/Power BI)', 'datavisualizationtableaupowerbi'),
  ('Marketing Analytics', 'marketinganalytics'),
  ('Operations / Supply Chain', 'operationssupplychain'),
  ('Product Management Fundamentals', 'productmanagementfundamentals'),
  ('Software Engineering Fundamentals', 'softwareengineeringfundamentals')
on conflict (normalized_name) do update
set name = excluded.name;

with keyword_map as (
  select * from (values
    ('corporatefinancevaluation', 'corporate finance'),
    ('corporatefinancevaluation', 'valuation'),
    ('corporatefinancevaluation', 'fin 340'),
    ('financialaccounting', 'intermediate accounting'),
    ('financialaccounting', 'financial accounting'),
    ('financialaccounting', 'acct 31'),
    ('managerialaccounting', 'managerial accounting'),
    ('managerialaccounting', 'cost accounting'),
    ('financialmodelingexcel', 'financial modeling'),
    ('financialmodelingexcel', 'excel'),
    ('investmentsportfoliotheory', 'investments'),
    ('investmentsportfoliotheory', 'portfolio'),
    ('statisticsprobability', 'statistics'),
    ('statisticsprobability', 'probability'),
    ('econometricsregression', 'econometrics'),
    ('econometricsregression', 'regression'),
    ('sqldatabases', 'sql'),
    ('sqldatabases', 'database'),
    ('datavisualizationtableaupowerbi', 'tableau'),
    ('datavisualizationtableaupowerbi', 'power bi'),
    ('datavisualizationtableaupowerbi', 'data visualization'),
    ('marketinganalytics', 'marketing analytics'),
    ('operationssupplychain', 'supply chain'),
    ('operationssupplychain', 'operations management'),
    ('productmanagementfundamentals', 'product management'),
    ('softwareengineeringfundamentals', 'software engineering'),
    ('softwareengineeringfundamentals', 'data structures')
  ) as v(category_norm, keyword)
)
insert into public.coursework_item_category_map (coursework_item_id, category_id)
select distinct ci.id, cc.id
from public.coursework_items ci
join keyword_map km
  on lower(ci.name) like '%' || km.keyword || '%'
join public.coursework_categories cc
  on cc.normalized_name = km.category_norm
on conflict do nothing;

insert into public.student_coursework_category_links (student_id, category_id)
select distinct sci.student_id, cicm.category_id
from public.student_coursework_items sci
join public.coursework_item_category_map cicm
  on cicm.coursework_item_id = sci.coursework_item_id
on conflict do nothing;

insert into public.internship_coursework_category_links (internship_id, category_id)
select distinct ici.internship_id, cicm.category_id
from public.internship_coursework_items ici
join public.coursework_item_category_map cicm
  on cicm.coursework_item_id = ici.coursework_item_id
on conflict do nothing;

with keyword_map as (
  select * from (values
    ('corporatefinancevaluation', 'corporate finance'),
    ('corporatefinancevaluation', 'valuation'),
    ('corporatefinancevaluation', 'fin 340'),
    ('financialaccounting', 'intermediate accounting'),
    ('financialaccounting', 'financial accounting'),
    ('managerialaccounting', 'managerial accounting'),
    ('managerialaccounting', 'cost accounting'),
    ('financialmodelingexcel', 'financial modeling'),
    ('financialmodelingexcel', 'excel'),
    ('investmentsportfoliotheory', 'investments'),
    ('investmentsportfoliotheory', 'portfolio'),
    ('statisticsprobability', 'statistics'),
    ('statisticsprobability', 'probability'),
    ('econometricsregression', 'econometrics'),
    ('econometricsregression', 'regression'),
    ('sqldatabases', 'sql'),
    ('sqldatabases', 'database'),
    ('datavisualizationtableaupowerbi', 'tableau'),
    ('datavisualizationtableaupowerbi', 'power bi'),
    ('datavisualizationtableaupowerbi', 'data visualization'),
    ('marketinganalytics', 'marketing analytics'),
    ('operationssupplychain', 'supply chain'),
    ('operationssupplychain', 'operations management'),
    ('productmanagementfundamentals', 'product management'),
    ('softwareengineeringfundamentals', 'software engineering')
  ) as v(category_norm, keyword)
),
student_coursework_text as (
  select sp.user_id as student_id, lower(trim(course_text)) as course_text
  from public.student_profiles sp,
  lateral unnest(coalesce(sp.coursework, '{}'::text[])) as course_text
)
insert into public.student_coursework_category_links (student_id, category_id)
select distinct sct.student_id, cc.id
from student_coursework_text sct
join keyword_map km on sct.course_text like '%' || km.keyword || '%'
join public.coursework_categories cc on cc.normalized_name = km.category_norm
on conflict do nothing;

with keyword_map as (
  select * from (values
    ('corporatefinancevaluation', 'corporate finance'),
    ('corporatefinancevaluation', 'valuation'),
    ('financialaccounting', 'financial accounting'),
    ('managerialaccounting', 'managerial accounting'),
    ('financialmodelingexcel', 'financial modeling'),
    ('investmentsportfoliotheory', 'investments'),
    ('statisticsprobability', 'statistics'),
    ('econometricsregression', 'econometrics'),
    ('sqldatabases', 'sql'),
    ('datavisualizationtableaupowerbi', 'tableau'),
    ('marketinganalytics', 'marketing analytics'),
    ('operationssupplychain', 'supply chain'),
    ('productmanagementfundamentals', 'product management'),
    ('softwareengineeringfundamentals', 'software engineering')
  ) as v(category_norm, keyword)
),
internship_coursework_text as (
  select i.id as internship_id, lower(trim(course_text)) as course_text
  from public.internships i,
  lateral unnest(coalesce(i.recommended_coursework, '{}'::text[])) as course_text
)
insert into public.internship_coursework_category_links (internship_id, category_id)
select distinct ict.internship_id, cc.id
from internship_coursework_text ict
join keyword_map km on ict.course_text like '%' || km.keyword || '%'
join public.coursework_categories cc on cc.normalized_name = km.category_norm
on conflict do nothing;
