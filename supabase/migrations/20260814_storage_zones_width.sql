-- Zone card grid span: 1 = half row, 2 = full row.
alter table public.storage_zones
  add column if not exists width integer not null default 1;

alter table public.storage_zones
  drop constraint if exists storage_zones_width_check;

alter table public.storage_zones
  add constraint storage_zones_width_check check (width in (1, 2));

comment on column public.storage_zones.width is
  'Home fridge grid span: 1 = half width, 2 = full width';
