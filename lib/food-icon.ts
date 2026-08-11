/**
 * Microsoft Fluent Emoji (Flat) mapping for fridge / recipe icons.
 * Source: https://github.com/microsoft/fluentui-emoji
 * CDN: jsDelivr → assets/{Folder}/Flat/{slug}_flat.svg
 */

type FluentAsset = {
  /** Folder name under assets/ (Title Case, may include spaces) */
  folder: string;
  /** File name, e.g. egg_flat.svg */
  file: string;
};

const FLUENT_CDN =
  "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets";

function asset(folder: string, file?: string): FluentAsset {
  const slug = folder
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return { folder, file: file ?? `${slug}_flat.svg` };
}

const DEFAULT_ICON = asset("Takeout box");

/** Exact / substring name → Fluent asset (longer keys preferred via sort) */
const NAME_ICONS: Record<string, FluentAsset> = {
  계란: asset("Egg"),
  달걀: asset("Egg"),
  우유: asset("Glass of milk"),
  요거트: asset("Glass of milk"),
  두부: asset("Beans"),
  콩: asset("Beans"),
  당근: asset("Carrot"),
  닭가슴살: asset("Poultry leg"),
  닭고기: asset("Poultry leg"),
  닭: asset("Poultry leg"),
  파프리카: asset("Bell pepper"),
  피망: asset("Bell pepper"),
  브로콜리: asset("Broccoli"),
  고등어: asset("Fish"),
  생선: asset("Fish"),
  새우: asset("Shrimp"),
  레몬: asset("Lemon"),
  양파: asset("Onion"),
  대파: asset("Onion"),
  파: asset("Onion"),
  감자: asset("Potato"),
  고구마: asset("Roasted sweet potato"),
  삼겹살: asset("Cut of meat"),
  돼지고기: asset("Cut of meat"),
  소고기: asset("Cut of meat"),
  쇠고기: asset("Cut of meat"),
  다진마늘: asset("Garlic"),
  마늘: asset("Garlic"),
  치즈: asset("Cheese wedge"),
  토마토: asset("Tomato"),
  오이: asset("Cucumber"),
  가지: asset("Eggplant"),
  버섯: asset("Mushroom"),
  옥수수: asset("Ear of corn"),
  밥: asset("Cooked rice"),
  쌀: asset("Cooked rice"),
  주먹밥: asset("Rice ball"),
  빵: asset("Baguette bread"),
  버터: asset("Butter"),
  소금: asset("Salt"),
  설탕: asset("Candy"),
  사과: asset("Red apple"),
  바나나: asset("Banana"),
  딸기: asset("Strawberry"),
  포도: asset("Grapes"),
  오렌지: asset("Tangerine"),
  김치: asset("Leafy green"),
  상추: asset("Leafy green"),
  시금치: asset("Leafy green"),
  채소: asset("Leafy green"),
  찌개: asset("Pot of food"),
  국: asset("Pot of food"),
  라면: asset("Steaming bowl"),
};

const CATEGORY_ICONS: Record<string, FluentAsset> = {
  채소: asset("Leafy green"),
  "채소·과일": asset("Leafy green"),
  과일: asset("Red apple"),
  육류: asset("Cut of meat"),
  "육류·어류": asset("Cut of meat"),
  해산물: asset("Fish"),
  수산물: asset("Fish"),
  양념: asset("Salt"),
  유제품: asset("Glass of milk"),
  "두부·콩류": asset("Beans"),
  기타: DEFAULT_ICON,
};

function fluentUrl(icon: FluentAsset): string {
  return `${FLUENT_CDN}/${encodeURIComponent(icon.folder)}/Flat/${encodeURIComponent(icon.file)}`;
}

function resolveAsset(
  name: string,
  category: string | null,
): FluentAsset {
  if (NAME_ICONS[name]) return NAME_ICONS[name];

  const keys = Object.keys(NAME_ICONS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (name.includes(key)) return NAME_ICONS[key];
  }

  if (category) {
    if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
    for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
      if (category.includes(key)) return icon;
    }
  }

  return DEFAULT_ICON;
}

/** Absolute URL to Fluent Flat SVG for this ingredient / recipe name. */
export function getFoodIconUrl(
  name: string,
  category: string | null = null,
): string {
  return fluentUrl(resolveAsset(name, category));
}

/** @deprecated Prefer FoodIcon component / getFoodIconUrl */
export function getFoodEmoji(name: string, category: string | null): string {
  // Kept for any leftover callers; returns empty — use <FoodIcon /> instead.
  void name;
  void category;
  return "";
}
