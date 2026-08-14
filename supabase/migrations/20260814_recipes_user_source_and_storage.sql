-- User recipes + recipe-photos storage policies
alter table public.recipes
  add column if not exists source text not null default 'system';
alter table public.recipes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recipes_source_check'
  ) then
    alter table public.recipes
      add constraint recipes_source_check
      check (source = any (array['system'::text, 'user'::text]));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "recipe_photos_public_read" on storage.objects;
create policy "recipe_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'recipe-photos');

drop policy if exists "recipe_photos_auth_insert" on storage.objects;
create policy "recipe_photos_auth_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recipe_photos_auth_update" on storage.objects;
create policy "recipe_photos_auth_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recipe_photos_auth_delete" on storage.objects;
create policy "recipe_photos_auth_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
