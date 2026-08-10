export type AmountUnitMode = "natural" | "grams";

/** 계량 표준 → g 환산 (액체/장류/기름·일반 계량 기준) */
const UNIT_TO_GRAMS: Record<string, number> = {
  큰술: 15,
  tbsp: 15,
  스푼: 15,
  작은술: 5,
  tsp: 5,
  티스푼: 5,
  컵: 200,
  cup: 200,
  ml: 1,
  밀리리터: 1,
  cc: 1,
};

/** 이름+단위 조합 환산 (1단위당 g) */
function gramsPerNameUnit(name: string, unit: string): number | null {
  const n = name.trim();
  const u = unit.trim().toLowerCase();

  if (
    (n.includes("계란") || n.includes("달걀")) &&
    (u === "개" || u === "알")
  ) {
    return 55; // 50~60g 중간값
  }
  if (n.includes("대파") && (u === "대" || u === "단")) {
    return 100;
  }
  if (n.includes("양파") && u === "개") {
    return 200;
  }
  if (n.includes("두부") && u === "모") {
    return 300;
  }
  return null;
}

function isDiscreteCount(
  name: string,
  unit: string | null | undefined,
): boolean {
  const u = (unit ?? "").trim();
  const discreteUnits = new Set([
    "개",
    "캔",
    "알",
    "쪽",
    "장",
    "팩",
    "봉지",
    "병",
    "모",
    "조각",
    "마리",
    "사리",
  ]);
  if (discreteUnits.has(u)) return true;
  const n = name.trim();
  return (
    n.includes("계란") ||
    n.includes("달걀") ||
    n.includes("캔") ||
    n.includes("라면사리") ||
    n.includes("사리")
  );
}

function isSeasoningUnit(unit: string | null | undefined): boolean {
  const u = (unit ?? "").trim().toLowerCase();
  return (
    u === "큰술" ||
    u === "작은술" ||
    u === "스푼" ||
    u === "티스푼" ||
    u === "tbsp" ||
    u === "tsp"
  );
}

/**
 * 소수부를 흔한 분수 문자열로. 해당 없으면 null.
 * 0.2~0.3 → 1/4 또는 1/3, 0.4~0.6 → 1/2, 0.7~0.8 → 3/4 또는 2/3
 */
function fractionLabel(frac: number): string | null {
  if (frac < 0.08) return null;
  if (frac < 0.2) return null; // 너무 작으면 아래 decimal 처리
  if (frac <= 0.3) {
    // 0.33에 가까우면 1/3, 아니면 1/4
    return Math.abs(frac - 1 / 3) < Math.abs(frac - 0.25) ? "1/3" : "1/4";
  }
  if (frac < 0.4) {
    return Math.abs(frac - 1 / 3) <= 0.05 ? "1/3" : "1/2";
  }
  if (frac <= 0.6) return "1/2";
  if (frac < 0.7) {
    return Math.abs(frac - 2 / 3) < 0.05 ? "2/3" : "1/2";
  }
  if (frac <= 0.85) {
    return Math.abs(frac - 2 / 3) < Math.abs(frac - 0.75) ? "2/3" : "3/4";
  }
  return null; // ≥0.9는 정수 반올림 쪽으로
}

function formatMixedNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";

  // 0.9 이상 소수 → 반올림 정수
  const nearestInt = Math.round(value);
  if (Math.abs(value - nearestInt) <= 0.1 && value >= 0.9) {
    return String(nearestInt);
  }

  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;

  if (frac < 0.08) {
    return whole > 0 ? String(whole) : formatSmallDecimal(value);
  }

  if (frac >= 0.9) {
    return String(whole + 1);
  }

  const label = fractionLabel(frac);
  if (label) {
    return whole > 0 ? `${whole}과 ${label}` : label;
  }

  // 나머지: 소수 한 자리
  return formatSmallDecimal(value);
}

function formatSmallDecimal(value: number): string {
  const one = Math.round(value * 10) / 10;
  if (Math.abs(one - Math.round(one)) < 1e-6) return String(Math.round(one));
  return String(one);
}

/**
 * 사람이 읽기 쉬운 식재료 수량 포맷 (일반 단위 모드).
 * - 계란/캔 등: 정수
 * - 양념(큰술/작은술): 분수·정수 위주
 * - 그 외: 0.9↑ 반올림, 1/4·1/2·3/4 등 분수
 */
export function formatIngredientAmount(
  amount: number | null | undefined,
  unit: string | null | undefined,
  ingredientName = "",
): string {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return unit?.trim() || "";
  }

  const raw = Number(amount);
  const u = unit?.trim() || "";
  const name = ingredientName.trim();

  if (isDiscreteCount(name, u)) {
    const n = Math.max(1, Math.round(raw));
    return `${n}${u}`;
  }

  if (isSeasoningUnit(u)) {
    const snapped = snapSeasoningAmount(raw);
    return `${snapped}${u}`;
  }

  // 이미 g면 정수/한 자리
  if (u.toLowerCase() === "g" || u === "그램") {
    return `${formatGramsNumber(raw)}g`;
  }

  const body = formatMixedNumber(raw);
  return `${body}${u}`;
}

/** 양념: 1, 1/2, 1/3, 1과 1/2 큰술 등 */
function snapSeasoningAmount(raw: number): string {
  if (raw <= 0) return "0";

  // 작은 양념도 최소 표현
  if (raw < 0.2) return formatSmallDecimal(Math.round(raw * 10) / 10);

  const whole = Math.floor(raw + 1e-9);
  const frac = raw - whole;

  if (frac < 0.12) {
    return whole > 0 ? String(whole) : formatSmallDecimal(raw);
  }
  if (frac >= 0.88) {
    return String(whole + 1);
  }

  // 가까운 분수 스냅: 1/4, 1/3, 1/2, 2/3, 3/4
  const candidates: { v: number; label: string }[] = [
    { v: 0.25, label: "1/4" },
    { v: 1 / 3, label: "1/3" },
    { v: 0.5, label: "1/2" },
    { v: 2 / 3, label: "2/3" },
    { v: 0.75, label: "3/4" },
  ];
  let best = candidates[0]!;
  let bestDist = Math.abs(frac - best.v);
  for (const c of candidates) {
    const d = Math.abs(frac - c.v);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }

  return whole > 0 ? `${whole}과 ${best.label}` : best.label;
}

function formatGramsNumber(g: number): string {
  if (!Number.isFinite(g) || g <= 0) return "0";
  if (g >= 10) return String(Math.round(g));
  const one = Math.round(g * 10) / 10;
  if (Math.abs(one - Math.round(one)) < 1e-6) return String(Math.round(one));
  return String(one);
}

/**
 * 일반 단위 수량을 g로 환산. 환산 불가면 null.
 */
export function convertAmountToGrams(
  amount: number | null | undefined,
  unit: string | null | undefined,
  ingredientName = "",
): number | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const raw = Number(amount);
  const u = (unit ?? "").trim();
  const uLower = u.toLowerCase();
  const name = ingredientName.trim();

  if (uLower === "g" || u === "그램" || uLower === "gram" || uLower === "grams") {
    return raw;
  }
  if (uLower === "kg" || u === "킬로그램") {
    return raw * 1000;
  }

  const byName = gramsPerNameUnit(name, u);
  if (byName != null) return raw * byName;

  const per = UNIT_TO_GRAMS[u] ?? UNIT_TO_GRAMS[uLower];
  if (per != null) return raw * per;

  return null;
}

/** g 모드 표시 문자열. 환산 불가 시 일반 포맷으로 폴백. */
export function formatIngredientAmountGrams(
  amount: number | null | undefined,
  unit: string | null | undefined,
  ingredientName = "",
): string {
  const grams = convertAmountToGrams(amount, unit, ingredientName);
  if (grams == null) {
    return formatIngredientAmount(amount, unit, ingredientName);
  }
  return `${formatGramsNumber(grams)}g`;
}

export function formatIngredientAmountForMode(
  amount: number | null | undefined,
  unit: string | null | undefined,
  ingredientName: string,
  mode: AmountUnitMode,
): string {
  if (mode === "grams") {
    return formatIngredientAmountGrams(amount, unit, ingredientName);
  }
  return formatIngredientAmount(amount, unit, ingredientName);
}
