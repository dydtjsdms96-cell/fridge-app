-- Fix: recipes/recipe_ingredients often have RLS enabled without SELECT policies,
-- which makes PostgREST return [] (HTTP 200) with no error — looking like "no recipes".
-- Also seed the two demo recipes used for fulfillment checks.

alter table if exists public.recipes enable row level security;
alter table if exists public.recipe_ingredients enable row level security;

drop policy if exists "레시피 전체 읽기" on public.recipes;
create policy "레시피 전체 읽기"
  on public.recipes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "레시피 재료 전체 읽기" on public.recipe_ingredients;
create policy "레시피 재료 전체 읽기"
  on public.recipe_ingredients
  for select
  to anon, authenticated
  using (true);

-- Seed only when titles are missing (safe to re-run)
insert into public.recipes (title, cook_minutes, difficulty, base_servings)
select v.title, v.cook_minutes, v.difficulty, 1
from (
  values
    ('계란찜', 15, '쉬움'),
    ('닭가슴살 브로콜리 볶음', 20, '쉬움')
) as v(title, cook_minutes, difficulty)
where not exists (
  select 1 from public.recipes r where r.title = v.title
);

insert into public.recipe_ingredients (recipe_id, ingredient_name, amount, unit, is_optional)
select r.id, v.ingredient_name, v.amount, v.unit, false
from public.recipes r
join (
  values
    ('계란찜', '계란', 3::numeric, '개'),
    ('계란찜', '대파', 0.5::numeric, '단'),
    ('닭가슴살 브로콜리 볶음', '닭가슴살', 150::numeric, 'g'),
    ('닭가슴살 브로콜리 볶음', '브로콜리', 100::numeric, 'g')
) as v(title, ingredient_name, amount, unit)
  on v.title = r.title
where not exists (
  select 1
  from public.recipe_ingredients ri
  where ri.recipe_id = r.id
    and ri.ingredient_name = v.ingredient_name
);
