-- barcode_lookup: per-user barcode → ingredient mapping
-- PK (user_id, barcode); input_method includes 바코드

alter table public.barcode_lookup drop constraint if exists barcode_lookup_pkey;
alter table public.barcode_lookup add primary key (user_id, barcode);

alter table public.fridge_items drop constraint if exists fridge_items_input_method_check;
alter table public.fridge_items add constraint fridge_items_input_method_check
  check (input_method = any (array['수동'::text, '음성'::text, '장보기전환'::text, '바코드'::text]));
