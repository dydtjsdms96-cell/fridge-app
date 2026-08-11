-- ============================================================
-- 냉장고 재고 관리 앱 - Supabase(Postgres) 스키마
-- ============================================================
-- 실행 순서: extensions → reference table → user-scoped tables → triggers → RLS
-- Supabase SQL Editor에 그대로 붙여넣어 실행 가능

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 0. 참조 테이블: 식재료 유통기한 자동 추천 DB
-- ------------------------------------------------------------
create table ingredient_ref (
  name text primary key,              -- 식재료명 (예: '파프리카')
  aliases text[] default '{}',        -- 유사어 (예: ['대파']->'파' 매칭용)
  default_zone text not null check (default_zone in ('냉장','냉동','실온','김치냉장고')),
  shelf_life_days int not null,       -- 기본 보관 일수
  category text                       -- 채소/육류/해산물/양념 등
);

-- ------------------------------------------------------------
-- 1. 사용자 프로필 (Supabase auth.users를 확장)
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  notify_time time default '08:00',   -- 유통기한 임박 알림 시간
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. 재고 (냉장고 속 식재료)
-- ------------------------------------------------------------
create table fridge_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,                       -- 채소/육류/해산물/양념 등
  zone text not null check (zone in ('냉장','냉동','실온','김치냉장고')),
  sub_zone text,                       -- storage_zones.label (예: 야채칸)
  quantity numeric not null default 1,
  unit text,                           -- g, ml, 개, 팩 등
  purchased_at date,
  expires_at date,                     -- ingredient_ref 기반 자동 계산, 수정 가능
  has_no_expiry boolean not null default false, -- true면 무기한, expires_at null
  status text not null default '보유' check (status in ('보유','소진','폐기')),
  input_method text check (input_method in ('수동','음성','장보기전환','바코드')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_fridge_items_user on fridge_items(user_id);
create index idx_fridge_items_status on fridge_items(user_id, status);
create index idx_fridge_items_expires on fridge_items(user_id, expires_at) where status = '보유';

-- ------------------------------------------------------------
-- 3. 레시피 & 필요 재료
-- ------------------------------------------------------------
create table recipes (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  cook_minutes int,
  difficulty text check (difficulty in ('쉬움','보통','어려움')),
  image_url text,
  steps jsonb,                         -- [{step:1, content:'...'}]
  base_servings int not null default 1 check (base_servings >= 1),
  created_at timestamptz default now()
);

create table recipe_ingredients (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_name text not null,
  amount numeric,
  unit text,
  is_optional boolean default false
);

create index idx_recipe_ingredients_recipe on recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_name on recipe_ingredients(ingredient_name);

-- ------------------------------------------------------------
-- 4. 주간 식단 플래너 (사용자가 직접 배치)
-- ------------------------------------------------------------
create table meal_plan (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete set null,
  plan_date date not null,
  meal_type text not null check (meal_type in ('아침','점심','저녁')),
  label text,                          -- recipe_id 없이 '외식/배달' 등 직접 입력 가능
  status text not null default '배치됨' check (status in ('배치됨','완료','외식')),
  created_at timestamptz default now(),
  unique (user_id, plan_date, meal_type, recipe_id)
);

create index idx_meal_plan_user_date on meal_plan(user_id, plan_date);

-- ------------------------------------------------------------
-- 5. 장보기 리스트
-- ------------------------------------------------------------
create table shopping_list (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  quantity numeric,
  unit text,
  source text check (source in ('자동_소진','자동_식단','수동')),
  checked boolean default false,
  created_at timestamptz default now()
);

create index idx_shopping_list_user on shopping_list(user_id, checked);

-- ------------------------------------------------------------
-- 6. 폐기/낭비 로그 (리포트용)
-- ------------------------------------------------------------
create table waste_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  quantity numeric,
  unit text,
  estimated_price numeric,
  logged_at date default current_date
);

create index idx_waste_log_user_date on waste_log(user_id, logged_at);

-- ------------------------------------------------------------
-- 7. 사용자 커스텀 카테고리
-- ------------------------------------------------------------
create table categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamptz default now()
);

create index idx_categories_user on categories(user_id);

-- ------------------------------------------------------------
-- 8. 사용자 하위 보관 구역 (base_zone 아래 label)
-- ------------------------------------------------------------
create table storage_zones (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  base_zone text not null check (base_zone in ('냉장','냉동','실온','김치냉장고')),
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create index idx_storage_zones_user on storage_zones(user_id, base_zone);
create index idx_storage_zones_user_base_sort on storage_zones(user_id, base_zone, sort_order);

-- ------------------------------------------------------------
-- 9. 바코드 → 재료 매핑 (사용자별 학습)
-- ------------------------------------------------------------
create table if not exists barcode_lookup (
  barcode text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  default_zone text check (default_zone is null or default_zone in ('냉장','냉동','실온','김치냉장고')),
  created_at timestamptz default now(),
  primary key (user_id, barcode)
);

-- ============================================================
-- 트리거: fridge_items 상태 변경 자동화
-- ============================================================

-- (a) 등록 시 ingredient_ref 기반으로 expires_at 자동 계산 (미입력 시)
create or replace function fn_fridge_item_autofill()
returns trigger as $$
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
$$ language plpgsql;

create trigger trg_fridge_item_autofill
before insert or update on fridge_items
for each row execute function fn_fridge_item_autofill();

-- (b) 폐기 처리 시 waste_log 자동 기록
create or replace function fn_fridge_item_to_waste_log()
returns trigger as $$
begin
  if new.status = '폐기' and old.status is distinct from '폐기' then
    insert into waste_log (user_id, item_name, quantity, unit, logged_at)
    values (new.user_id, new.name, new.quantity, new.unit, current_date);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_fridge_item_to_waste_log
after update on fridge_items
for each row execute function fn_fridge_item_to_waste_log();

-- ============================================================
-- Row Level Security: 내 데이터만 접근 가능
-- ============================================================
alter table profiles enable row level security;
alter table fridge_items enable row level security;
alter table meal_plan enable row level security;
alter table shopping_list enable row level security;
alter table waste_log enable row level security;
alter table categories enable row level security;
alter table storage_zones enable row level security;
-- recipes, recipe_ingredients, ingredient_ref는 전체 공개 참조 데이터.
-- RLS를 켤 경우 SELECT 정책을 반드시 추가할 것 (정책 없으면 클라이언트가 []만 받음).
-- 참고: supabase/migrations/20260809_recipes_public_read_and_seed.sql

create policy "본인 프로필만 조회/수정" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "본인 재고만 조회/수정" on fridge_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "본인 식단만 조회/수정" on meal_plan
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "본인 장보기 리스트만 조회/수정" on shopping_list
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "본인 낭비 로그만 조회" on waste_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "본인 카테고리만 조회/수정" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "본인 구역만 조회/수정" on storage_zones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 초기 시드 데이터 예시 (ingredient_ref)
-- ============================================================
insert into ingredient_ref (name, aliases, default_zone, shelf_life_days, category) values
  ('대파', array['파'], '냉장', 10, '채소'),
  ('계란', array['달걀'], '냉장', 21, '기타'),
  ('두부', array[]::text[], '냉장', 5, '기타'),
  ('삼겹살', array['돼지고기'], '냉장', 3, '육류'),
  ('감자', array[]::text[], '실온', 30, '채소'),
  ('양파', array[]::text[], '실온', 30, '채소'),
  ('다진마늘', array['마늘'], '냉동', 90, '양념');
