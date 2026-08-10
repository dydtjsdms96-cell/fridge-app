const NAME_EMOJI: Record<string, string> = {
  계란: "🥚",
  달걀: "🥚",
  우유: "🥛",
  두부: "🫘",
  당근: "🥕",
  닭가슴살: "🍗",
  파프리카: "🫑",
  브로콜리: "🥦",
  고등어: "🐟",
  레몬: "🍋",
  양파: "🧅",
  대파: "🧅",
  파: "🧅",
  감자: "🥔",
  삼겹살: "🥩",
  돼지고기: "🥩",
  다진마늘: "🧄",
  마늘: "🧄",
  치즈: "🧀",
  요거트: "🍶",
};

const CATEGORY_EMOJI: Record<string, string> = {
  채소: "🥬",
  육류: "🥩",
  해산물: "🐟",
  양념: "🧂",
  유제품: "🥛",
  기타: "🍽️",
};

export function getFoodEmoji(name: string, category: string | null): string {
  if (NAME_EMOJI[name]) return NAME_EMOJI[name];

  for (const [key, emoji] of Object.entries(NAME_EMOJI)) {
    if (name.includes(key)) return emoji;
  }

  if (category && CATEGORY_EMOJI[category]) return CATEGORY_EMOJI[category];
  return "🍽️";
}
