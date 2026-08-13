import type { StorageZone } from "@/types/database";

export type ParsedVoiceItem = {
  name: string;
  quantity: number;
  unit: string;
  zone: StorageZone;
  category: string;
};

const COMMAND_NOISE: RegExp[] = [
  /빅스비[,.]?/gi,
  /헤이\s*구글[,.]?/gi,
  /프레시\s*포켓(에|으로|에서|을|를)?/gi,
  /냉장고(에|로|을|를)?/gi,
  /(추가|등록|넣어|담아)(해|해줘|해 줘|주세요|요)?/gi,
  /(부탁|좀)\s*(해|드려요|해주세요)?/gi,
  /해주세요/gi,
  /해줘/gi,
];

/** Longer aliases first for regex alternation */
const UNIT_ALIASES: Array<[string, string]> = [
  ["밀리리터", "ml"],
  ["킬로그램", "kg"],
  ["리터", "L"],
  ["그램", "g"],
  ["킬로", "kg"],
  ["ml", "ml"],
  ["ML", "ml"],
  ["mL", "ml"],
  ["kg", "kg"],
  ["KG", "kg"],
  ["개", "개"],
  ["알", "개"],
  ["팩", "팩"],
  ["봉", "봉"],
  ["병", "병"],
  ["장", "장"],
  ["포", "포"],
  ["망", "망"],
  ["줄", "줄"],
  ["통", "통"],
  ["모", "모"],
  ["쪽", "쪽"],
  ["컵", "컵"],
  ["L", "L"],
  ["l", "L"],
  ["g", "g"],
  ["G", "g"],
];

const UNIT_PATTERN = UNIT_ALIASES.map(([a]) =>
  a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
).join("|");

const FROZEN_KEYWORDS = [
  "아이스크림",
  "냉동",
  "냉동만두",
  "군만두",
  "핫도그",
  "냉동과일",
  "냉동베리",
];

const ROOM_KEYWORDS = [
  "양파",
  "감자",
  "고구마",
  "마늘",
  "생강",
  "쌀",
  "라면",
  "면",
  "과자",
  "빵",
  "통조림",
  "참치캔",
  "식용유",
  "설탕",
  "소금",
  "간장",
];

const CATEGORY_BY_KEYWORD: Array<[string, string]> = [
  ["우유", "유제품"],
  ["요거트", "유제품"],
  ["치즈", "유제품"],
  ["버터", "유제품"],
  ["계란", "기타"],
  ["달걀", "기타"],
  ["두부", "두부·콩류"],
  ["콩", "두부·콩류"],
  ["닭", "육류·어류"],
  ["돼지", "육류·어류"],
  ["소고기", "육류·어류"],
  ["쇠고기", "육류·어류"],
  ["삼겹", "육류·어류"],
  ["생선", "육류·어류"],
  ["고등어", "육류·어류"],
  ["새우", "육류·어류"],
  ["사과", "채소·과일"],
  ["바나나", "채소·과일"],
  ["딸기", "채소·과일"],
  ["포도", "채소·과일"],
  ["토마토", "채소·과일"],
  ["양파", "채소·과일"],
  ["대파", "채소·과일"],
  ["당근", "채소·과일"],
  ["상추", "채소·과일"],
  ["시금치", "채소·과일"],
  ["브로콜리", "채소·과일"],
  ["김치", "기타"],
  ["라면", "기타"],
];

function normalizeUnit(raw: string | undefined): string {
  if (!raw) return "개";
  const trimmed = raw.trim();
  for (const [alias, canon] of UNIT_ALIASES) {
    if (alias.toLowerCase() === trimmed.toLowerCase() || alias === trimmed) {
      return canon;
    }
  }
  return trimmed || "개";
}

export function guessZone(name: string): StorageZone {
  const n = name.replace(/\s+/g, "");
  if (FROZEN_KEYWORDS.some((k) => n.includes(k))) return "냉동";
  if (ROOM_KEYWORDS.some((k) => n.includes(k))) return "실온";
  if (n.includes("김치")) return "김치냉장고";
  return "냉장";
}

export function guessCategory(name: string): string {
  const n = name.replace(/\s+/g, "");
  for (const [keyword, category] of CATEGORY_BY_KEYWORD) {
    if (n.includes(keyword)) return category;
  }
  return "기타";
}

/** Strip assistant / app command fluff from a spoken sentence. */
export function normalizeVoiceUtterance(raw: string): string {
  let s = raw.trim();
  for (const re of COMMAND_NOISE) {
    s = s.replace(re, " ");
  }
  // Comma / connective → space so "계란, 두부 대파" splits cleanly
  s = s.replace(/[,，、]/g, " ");
  s = s.replace(/\s*(?:랑|이랑|하고|와|과|및|그리고)\s*/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function enrich(name: string, quantity: number, unit: string): ParsedVoiceItem {
  const cleanName = name.replace(/\s+/g, " ").trim();
  return {
    name: cleanName,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit: normalizeUnit(unit),
    zone: guessZone(cleanName),
    category: guessCategory(cleanName),
  };
}

/**
 * Parse a Korean fridge-add utterance into items.
 * Examples:
 * - "우유 1.8L 계란 10개 추가해줘"
 * - "프레시포켓에 두부랑 대파 넣어줘"
 * - "1.8리터 우유"
 */
export function parseVoiceUtterance(raw: string): ParsedVoiceItem[] {
  const text = normalizeVoiceUtterance(raw);
  if (!text) return [];

  const items: ParsedVoiceItem[] = [];
  const consumed = new Array(text.length).fill(false);

  function mark(start: number, end: number) {
    for (let i = start; i < end; i++) consumed[i] = true;
  }

  function overlaps(start: number, end: number) {
    for (let i = start; i < end; i++) if (consumed[i]) return true;
    return false;
  }

  // name + quantity + optional unit  (우유 1.8L, 계란 10개)
  const nameQtyRe = new RegExp(
    `([가-힣A-Za-z][가-힣A-Za-z0-9]*)\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})?`,
    "gi",
  );
  for (const match of text.matchAll(nameQtyRe)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    mark(start, end);
    items.push(enrich(match[1], Number(match[2]), match[3] ?? "개"));
  }

  // quantity + unit + name  (1.8L 우유, 10개 계란)
  const qtyNameRe = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\s*([가-힣A-Za-z][가-힣A-Za-z0-9]*)`,
    "gi",
  );
  for (const match of text.matchAll(qtyNameRe)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    mark(start, end);
    items.push(enrich(match[3], Number(match[1]), match[2]));
  }

  // leftover bare names (두부 대파)
  const leftover = text
    .split("")
    .map((ch, i) => (consumed[i] ? " " : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (leftover) {
    for (const token of leftover.split(" ")) {
      if (!token || /^\d/.test(token)) continue;
      if (UNIT_ALIASES.some(([a]) => a.toLowerCase() === token.toLowerCase())) {
        continue;
      }
      items.push(enrich(token, 1, "개"));
    }
  }

  // de-dupe consecutive identical names by merging qty
  const merged: ParsedVoiceItem[] = [];
  for (const item of items) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.name === item.name &&
      prev.unit === item.unit &&
      prev.zone === item.zone
    ) {
      prev.quantity += item.quantity;
    } else {
      merged.push({ ...item });
    }
  }

  return merged;
}
