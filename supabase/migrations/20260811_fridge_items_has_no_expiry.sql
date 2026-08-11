-- 유통기한 없음(무기한) 플래그
alter table public.fridge_items
  add column if not exists has_no_expiry boolean not null default false;

comment on column public.fridge_items.has_no_expiry is
  'true면 유통기한 없음(무기한). expires_at은 null.';

update public.fridge_items
set expires_at = null
where has_no_expiry = true and expires_at is not null;

create or replace function public.fn_fridge_item_autofill()
returns trigger
language plpgsql
as $$
declare
  ref ingredient_ref%rowtype;
begin
  if coalesce(new.has_no_expiry, false) then
    new.expires_at := null;
    new.updated_at := now();
    return new;
  end if;

  if new.expires_at is null then
    select * into ref from ingredient_ref
      where name = new.name or new.name = any(aliases)
      limit 1;
    if found then
      new.expires_at := coalesce(new.purchased_at, current_date) + ref.shelf_life_days;
      new.zone := coalesce(new.zone, ref.default_zone);
      new.category := coalesce(new.category, ref.category);
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
