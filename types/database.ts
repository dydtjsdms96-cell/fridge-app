export type StorageZone = "냉장" | "냉동" | "실온" | "김치냉장고";

export type FridgeItemStatus = "보유" | "소진" | "폐기";

export type FridgeItemType = "원재료" | "완성요리";

export type FridgeInputMethod = "수동" | "음성" | "장보기전환" | "바코드";

export type RecipeDifficulty = "쉬움" | "보통" | "어려움";

export type DishType = "메인요리" | "밑반찬";

export type RecipeSource = "system" | "user";

export type MealType = "아침" | "점심" | "저녁";

export type MealPlanStatus = "배치됨" | "완료" | "외식";

export type ShoppingListSource = "자동_소진" | "자동_식단" | "수동";

export interface RecipeStep {
  step: number;
  content: string;
}

export interface IngredientRef {
  name: string;
  aliases: string[] | null;
  default_zone: StorageZone;
  shelf_life_days: number;
  category: string | null;
}

export interface Profile {
  id: string;
  notify_time: string | null;
  created_at: string | null;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  created_at: string | null;
}

/** User-defined sub-zone under a base StorageZone (e.g. 냉장 > 야채칸). */
export interface StorageZoneRow {
  id: string;
  user_id: string;
  base_zone: StorageZone;
  label: string;
  sort_order: number;
  /** Grid column span: 1 = half row, 2 = full row */
  width: 1 | 2;
  created_at: string | null;
}

/** User-learned barcode → ingredient mapping (per user). */
export interface BarcodeLookup {
  barcode: string;
  user_id: string;
  name: string;
  category: string | null;
  default_zone: StorageZone | null;
  created_at: string | null;
}

export interface FridgeItem {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  zone: StorageZone;
  sub_zone: string | null;
  quantity: number;
  unit: string | null;
  purchased_at: string | null;
  expires_at: string | null;
  /** true면 유통기한 없음(무기한). expires_at은 null. */
  has_no_expiry: boolean;
  status: FridgeItemStatus;
  /** 원재료(기본) | 완성요리(만든 음식) */
  item_type: FridgeItemType;
  input_method: FridgeInputMethod | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  cook_minutes: number | null;
  difficulty: RecipeDifficulty | null;
  image_url: string | null;
  steps: RecipeStep[] | null;
  /** 재료량 기준 인분 (시드 기본 1) */
  base_servings: number;
  /** 메인요리 | 밑반찬 */
  dish_type: DishType;
  /** system | user */
  source: RecipeSource;
  /** user 레시피 작성자 (system이면 null) */
  user_id: string | null;
  created_at: string | null;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  amount: number | null;
  unit: string | null;
  is_optional: boolean | null;
}

export interface MealPlan {
  id: string;
  user_id: string;
  recipe_id: string | null;
  plan_date: string;
  meal_type: MealType;
  label: string | null;
  status: MealPlanStatus;
  created_at: string | null;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  source: ShoppingListSource | null;
  checked: boolean | null;
  created_at: string | null;
}

export interface WasteLog {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  estimated_price: number | null;
  logged_at: string | null;
}
