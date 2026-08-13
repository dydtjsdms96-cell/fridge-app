export type AmountUnitMode = "natural" | "grams";

/** 계량 → g (액체는 밀도≈1 가정) */
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
  L: 1000,
  l: 1000,
  리터: 1000,
};

/** 이름+단위 조합 환산 (1단위당 g) */
function gramsPerNameUnit(name: string, unit: string): number | null {
  const n = name.trim();
  const u = unit.trim().toLowerCase();

  if (
    (n.includes("계란") || n.includes("달걀")) &&
    (u === "개" || u === "알")
  ) {
    return 55;
  }
  if (n.includes("대파") && (u === "대" || u === "단")) {
    return 100;
  }
  if (n.includes("양파") && u === "개") {
    return 200;
  }
  if (n.includes("감자") && u === "개") {
    return 150;
  }
  if (n.includes("당근") && u === "개") {
    return 120;
  }
  if (n.includes("두부") && u === "모") {
    return 300;
  }
  if (n.includes("버섯") && (u === "봉" || u === "팩")) {
    return 150;
  }
  if (
    (n.includes("우동") || n.includes("면") || n.includes("사리")) &&
    (u === "개" || u === "사리" || u === "봉")
  ) {
    return 200;
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
    "봉",
    "병",
    "모",
    "조각",
    "마리",
    "사리",
    "대",
    "단",
  ]);
  if (discreteUnits.has(u)) return true;
  const n = name.trim();
  return (
    ((n.includes("계란") || n.includes("달걀")) && (!u || u === "개")) ||
    n.includes("캔")
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

function fractionLabel(frac: number): string | null {
  if (frac < 0.08) return null;
  if (frac < 0.2) return null;
  if (frac <= 0.3) {
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
  return null;
}

function formatMixedNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";

  const nearestInt = Math.round(value);
  if (Math.abs(value - nearestInt) <= 0.08 && value >= 0.92) {
    return String(nearestInt);
  }

  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;

  if (frac < 0.08) {
    return whole > 0 ? String(whole) : formatSmallDecimal(value);
  }

  if (frac >= 0.92) {
    return String(whole + 1);
  }

  const label = fractionLabel(frac);
  if (label) {
    return whole > 0 ? `${whole}과 ${label}` : label;
  }

  return formatSmallDecimal(value);
}

function formatSmallDecimal(value: number): string {
  const one = Math.round(value * 10) / 10;
  if (Math.abs(one - Math.round(one)) < 1e-6) return String(Math.round(one));
  return String(one);
}

function formatGramsNumber(g: number): string {
  if (!Number.isFinite(g) || g <= 0) return "0";
  if (g >= 10) return String(Math.round(g));
  const one = Math.round(g * 10) / 10;
  if (Math.abs(one - Math.round(one)) < 1e-6) return String(Math.round(one));
  return String(one);
}

/**
 * 일반 단위 모드: 레시피 단위를 읽기 쉽게.
 * - g ≥ 1000 → kg
 * - ml ≥ 1000 → L
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
  const uLower = u.toLowerCase();
  const name = ingredientName.trim();

  // g ↔ kg (일반 모드에서는 큰 값을 kg로)
  if (uLower === "g" || u === "그램") {
    if (raw >= 1000) {
      return `${formatSmallDecimal(raw / 1000)}kg`;
    }
    return `${formatGramsNumber(raw)}g`;
  }
  if (uLower === "kg" || u === "킬로그램") {
    return `${formatSmallDecimal(raw)}kg`;
  }

  // ml ↔ L
  if (uLower === "ml" || u === "밀리리터" || uLower === "cc") {
    if (raw >= 1000) {
      return `${formatSmallDecimal(raw / 1000)}L`;
    }
    return `${formatGramsNumber(raw)}ml`;
  }
  if (uLower === "l" || u === "리터") {
    return `${formatSmallDecimal(raw)}L`;
  }

  if (isDiscreteCount(name, u)) {
    // 소수 개수(0.5개 등)는 분수로, 정수에 가까우면 정수
    if (Math.abs(raw - Math.round(raw)) < 0.08 && raw >= 0.92) {
      return `${Math.max(1, Math.round(raw))}${u}`;
    }
    return `${formatMixedNumber(raw)}${u}`;
  }

  if (isSeasoningUnit(u)) {
    const snapped = snapSeasoningAmount(raw);
    return `${snapped}${u}`;
  }

  const body = formatMixedNumber(raw);
  return `${body}${u}`;
}

function snapSeasoningAmount(raw: number): string {
  if (raw <= 0) return "0";
  if (raw < 0.2) return formatSmallDecimal(Math.round(raw * 10) / 10);

  const whole = Math.floor(raw + 1e-9);
  const frac = raw - whole;

  if (frac < 0.12) {
    return whole > 0 ? String(whole) : formatSmallDecimal(raw);
  }
  if (frac >= 0.88) {
    return String(whole + 1);
  }

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

/**
 * 일반 단위 → g. 환산 불가면 null.
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

/** g 모드: 가능하면 모두 g로. 불가하면 원문 + 표시. */
export function formatIngredientAmountGrams(
  amount: number | null | undefined,
  unit: string | null | undefined,
  ingredientName = "",
): string {
  const grams = convertAmountToGrams(amount, unit, ingredientName);
  if (grams == null) {
    const natural = formatIngredientAmount(amount, unit, ingredientName);
    return natural ? `${natural}` : "";
  }
  // g 모드에서는 kg로 올리지 않고 g로 통일 (토글 대비가 보이도록)
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
