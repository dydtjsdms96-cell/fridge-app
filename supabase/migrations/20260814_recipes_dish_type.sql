-- recipes.dish_type: 메인요리 | 밑반찬 (이미 원격에 적용된 경우 no-op)
alter table public.recipes
  add column if not exists dish_type text not null default '메인요리';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipes_dish_type_check'
  ) then
    alter table public.recipes
      add constraint recipes_dish_type_check
      check (dish_type = any (array['메인요리'::text, '밑반찬'::text]));
  end if;
end $$;
