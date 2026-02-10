-- Quick seed for coursework category taxonomy (idempotent).
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
)
insert into public.coursework_item_category_map (coursework_item_id, category_id)
select distinct ci.id, cc.id
from public.coursework_items ci
join keyword_map km on lower(ci.name) like '%' || km.keyword || '%'
join public.coursework_categories cc on cc.normalized_name = km.category_norm
on conflict do nothing;
