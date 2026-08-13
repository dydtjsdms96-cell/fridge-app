export type ScaleMode = "linear" | "discrete" | "mild";

/** 양념·소스·조미료 — mild 스케일 적용 */
const MILD_KEYWORDS = [
  "간장",
  "고추장",
  "고춧가루",
  "된장",
  "굴소스",
  "설탕",
  "소금",
  "참기름",
  "식용유",
  "마늘",
  "다진마늘",
  "후추",
  "올리고당",
  "맛술",
  "미림",
  "식초",
  "케첩",
  "마요네즈",
  "버터",
  "오일",
  "기름",
  "조미료",
  "다시다",
  "액젓",
  "멸치액젓",
  "들기름",
  "밥",
  "공기밥",
  "흰밥",
  "쌀밥",
  "햇반",
] as const;

/** 개수 단위 — 비례 스케일 후 보기 좋게 반올림 */
const DISCRETE_UNITS = new Set([
  "개",
  "캔",
  "알",
  "쪽",
  "장",
  "팩",
  "봉지",
  "봉",
  "병",
  "모",
  "조각",
  "마리",
  "대",
  "단",
  "사리",
]);

const DISCRETE_NAME_KEYWORDS = ["계란", "달걀", "캔"] as const;

export const SERVING_OPTIONS = [1, 2, 3, 4] as const;
export type ServingOption = (typeof SERVING_OPTIONS)[number];

export function normalizeBaseServings(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function detectScaleMode(
  ingredientName: string,
  unit: string | null | undefined,
): ScaleMode {
  if (isMildSeasoning(ingredientName)) return "mild";

  const name = ingredientName.trim().toLowerCase();
  const u = (unit ?? "").trim().toLowerCase();
  if (DISCRETE_UNITS.has(u)) return "discrete";
  if (DISCRETE_NAME_KEYWORDS.some((kw) => name.includes(kw.toLowerCase()))) {
    return "discrete";
  }

  return "linear";
}

/** 양념·소스·조미료 — 재료 목록/매칭/쇼핑에서는 표시하지 않음 */
export function isMildSeasoning(ingredientName: string): boolean {
  const name = ingredientName.trim().toLowerCase();
  if (!name) return false;
  return MILD_KEYWORDS.some((kw) => name.includes(kw.toLowerCase()));
}

/**
 * 양념 mild: 인분에 완전 비례하지 않고 √비율에 가깝게 완만 증가.
 * ratio=1 → 1, ratio=4 → 2, ratio=2 ≈ 1.41
 */
function mildFactor(ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.sqrt(ratio);
}

function roundNice(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= 100) return Math.round(value);
  if (Math.abs(value) >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * 개수 단위: 기준량×비율을 유지하되, 정수 기준량은 정수로,
 * 소수 기준량(0.25개 등)은 비례값을 그대로 살려 인분 변화가 화면에 보이게 함.
 */
function scaleDiscrete(raw: number, ratio: number): number {
  const scaled = raw * ratio;
  if (!Number.isFinite(scaled) || scaled <= 0) return 0;

  // 원래가 정수 개수면 결과도 정수 (최소 1은 강제하지 않음 — 0.5→1 인분 축소 허용)
  if (Math.abs(raw - Math.round(raw)) < 1e-9 && raw >= 1) {
    return Math.max(1, Math.round(scaled));
  }

  // 소수 기준량: 1/2, 1/4 등이 인분에 따라 달라지도록 roundNice
  return roundNice(scaled);
}

/**
 * 기준 인분 재료량 → 목표 인분 재료량.
 * amount = 기준(base_servings)일 때 양. 비율 = target / base.
 */
export function scaleIngredientAmount(
  amount: number | null | undefined,
  opts: {
    ingredientName: string;
    unit?: string | null;
    baseServings: number;
    targetServings: number;
  },
): number | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;

  const base = normalizeBaseServings(opts.baseServings);
  const target = Math.max(1, Math.floor(Number(opts.targetServings) || 1));
  const ratio = target / base;
  const raw = Number(amount);
  if (ratio === 1) return raw;

  const mode = detectScaleMode(opts.ingredientName, opts.unit);

  if (mode === "mild") {
    return roundNice(raw * mildFactor(ratio));
  }

  if (mode === "discrete") {
    return scaleDiscrete(raw, ratio);
  }

  return roundNice(raw * ratio);
}

export type ScaledIngredient = {
  id: string;
  ingredient_name: string;
  unit: string | null;
  is_optional: boolean | null;
  baseAmount: number | null;
  scaledAmount: number | null;
  scaleMode: ScaleMode;
};

export function scaleRecipeIngredients<
  T extends {
    id: string;
    ingredient_name: string;
    amount: number | null;
    unit: string | null;
    is_optional: boolean | null;
  },
>(
  ingredients: T[],
  baseServings: number,
  targetServings: number,
): ScaledIngredient[] {
  const base = normalizeBaseServings(baseServings);
  return ingredients.map((ing) => ({
    id: ing.id,
    ingredient_name: ing.ingredient_name,
    unit: ing.unit,
    is_optional: ing.is_optional,
    baseAmount: ing.amount == null ? null : Number(ing.amount),
    scaledAmount: scaleIngredientAmount(ing.amount, {
      ingredientName: ing.ingredient_name,
      unit: ing.unit,
      baseServings: base,
      targetServings,
    }),
    scaleMode: detectScaleMode(ing.ingredient_name, ing.unit),
  }));
}
