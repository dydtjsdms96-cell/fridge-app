-- Recipe ingredient amounts are authored per base_servings (default 1).
alter table public.recipes
  add column if not exists base_servings integer not null default 1
  check (base_servings >= 1);

update public.recipes
set base_servings = 1
where base_servings is distinct from 1;

comment on column public.recipes.base_servings is
  '레시피 재료량이 기준이 되는 인분 수 (기본 1인분)';
