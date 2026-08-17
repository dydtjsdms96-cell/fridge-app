/**
 * Microsoft Fluent Emoji (Flat) mapping for fridge / recipe icons.
 * Source: https://github.com/microsoft/fluentui-emoji
 * CDN: jsDelivr → assets/{Folder}/Flat/{slug}_flat.svg
 *
 * Matching: longest keyword substring wins (see resolveAsset).
 * Prefer concrete food assets; category-level icons are the last stop before Takeout box.
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

/**
 * Keyword → Fluent asset.
 * Longer keys win when multiple substrings match (e.g. 파스타 before 파).
 */
const NAME_ICONS: Record<string, FluentAsset> = {
  // Eggs
  메추리알: asset("Egg"),
  계란: asset("Egg"),
  달걀: asset("Egg"),
  난황: asset("Egg"),
  난백: asset("Egg"),

  // Dairy
  체다치즈: asset("Cheese wedge"),
  모짜렐라: asset("Cheese wedge"),
  치즈: asset("Cheese wedge"),
  버터: asset("Butter"),
  생크림: asset("Glass of milk"),
  휘핑크림: asset("Glass of milk"),
  요거트: asset("Bowl with spoon"),
  요구르트: asset("Bowl with spoon"),
  두유: asset("Glass of milk"),
  우유: asset("Glass of milk"),
  연유: asset("Glass of milk"),

  // Processed meat
  베이컨: asset("Bacon"),
  비엔나소세지: asset("Hot dog"),
  비엔나소시지: asset("Hot dog"),
  분홍소시지: asset("Hot dog"),
  소세지: asset("Hot dog"),
  소시지: asset("Hot dog"),
  핫도그: asset("Hot dog"),
  스팸: asset("Canned food"),
  런천미트: asset("Canned food"),
  햄: asset("Cut of meat"),

  // Bread / bakery
  베이글: asset("Bagel"),
  바게트: asset("Baguette bread"),
  크루아상: asset("Croissant"),
  크로와상: asset("Croissant"),
  식빵: asset("Bread"),
  또띠아: asset("Flatbread"),
  또르티야: asset("Flatbread"),
  토르티야: asset("Flatbread"),
  플랫브레드: asset("Flatbread"),
  프레첼: asset("Pretzel"),
  와플: asset("Waffle"),
  팬케이크: asset("Pancakes"),
  빵: asset("Baguette bread"),

  // Fresh meat
  닭가슴살: asset("Poultry leg"),
  닭고기: asset("Poultry leg"),
  닭다리: asset("Poultry leg"),
  닭봉: asset("Poultry leg"),
  닭: asset("Poultry leg"),
  오리고기: asset("Poultry leg"),
  삼겹살: asset("Cut of meat"),
  목살: asset("Cut of meat"),
  돼지고기: asset("Cut of meat"),
  돼지: asset("Cut of meat"),
  차돌박이: asset("Cut of meat"),
  우삼겹: asset("Cut of meat"),
  등심: asset("Cut of meat"),
  안심: asset("Cut of meat"),
  채끝: asset("Cut of meat"),
  소고기: asset("Cut of meat"),
  쇠고기: asset("Cut of meat"),
  한우: asset("Cut of meat"),
  양고기: asset("Meat on bone"),
  갈비: asset("Meat on bone"),
  다진고기: asset("Cut of meat"),
  다짐육: asset("Cut of meat"),
  고기: asset("Cut of meat"),

  // Seafood
  골뱅이: asset("Spiral shell"),
  조개: asset("Oyster"),
  홍합: asset("Oyster"),
  바지락: asset("Oyster"),
  전복: asset("Oyster"),
  굴소스: asset("Bottle with popping cork"),
  굴: asset("Oyster"),
  새우젓: asset("Shrimp"),
  새우: asset("Shrimp"),
  대하: asset("Shrimp"),
  오징어: asset("Squid"),
  한치: asset("Squid"),
  진미채: asset("Squid"),
  문어: asset("Octopus"),
  낙지: asset("Octopus"),
  주꾸미: asset("Octopus"),
  크래미: asset("Crab"),
  게맛살: asset("Crab"),
  게장: asset("Crab"),
  게: asset("Crab"),
  랍스터: asset("Lobster"),
  고등어: asset("Fish"),
  연어: asset("Fish"),
  참치캔: asset("Canned food"),
  통조림참치: asset("Canned food"),
  참치액: asset("Fish"),
  참치: asset("Fish"),
  멸치액젓: asset("Fish"),
  잔멸치: asset("Fish"),
  중멸치: asset("Fish"),
  멸치: asset("Fish"),
  명란젓: asset("Fish"),
  명란: asset("Fish"),
  어묵: asset("Fish cake with swirl"),
  오뎅: asset("Oden"),
  생선: asset("Fish"),
  회: asset("Sushi"),
  해산물: asset("Tropical fish"),

  // Veg / spice
  청양고추: asset("Hot pepper"),
  꽈리고추: asset("Hot pepper"),
  페퍼론치노: asset("Hot pepper"),
  고춧가루: asset("Hot pepper"),
  고추가루: asset("Hot pepper"),
  고추장: asset("Hot pepper"),
  고추: asset("Hot pepper"),
  파프리카: asset("Bell pepper"),
  피망: asset("Bell pepper"),
  다진마늘: asset("Garlic"),
  마늘: asset("Garlic"),
  생강: asset("Ginger root"),
  고구마: asset("Roasted sweet potato"),
  감자: asset("Potato"),
  당근: asset("Carrot"),
  브로콜리: asset("Broccoli"),
  토마토: asset("Tomato"),
  오이: asset("Cucumber"),
  가지: asset("Eggplant"),
  애호박: asset("Cucumber"),
  호박: asset("Cucumber"),
  느타리버섯: asset("Mushroom"),
  새송이버섯: asset("Mushroom"),
  팽이버섯: asset("Mushroom"),
  표고: asset("Mushroom"),
  버섯: asset("Mushroom"),
  옥수수: asset("Ear of corn"),
  양파: asset("Onion"),
  대파: asset("Onion"),
  쪽파: asset("Onion"),
  실파: asset("Onion"),
  파뿌리: asset("Onion"),
  파채: asset("Onion"),
  // bare "파": longer keys (파스타·파프리카) match first
  파: asset("Onion"),
  양배추: asset("Leafy green"),
  배추: asset("Leafy green"),
  상추: asset("Leafy green"),
  깻잎: asset("Leafy green"),
  시금치: asset("Leafy green"),
  청경채: asset("Leafy green"),
  쑥갓: asset("Leafy green"),
  미나리: asset("Leafy green"),
  숙주: asset("Leafy green"),
  콩나물: asset("Leafy green"),
  무순: asset("Leafy green"),
  단무지: asset("Leafy green"),
  무: asset("Leafy green"),
  신김치: asset("Leafy green"),
  김치: asset("Leafy green"),
  채소: asset("Leafy green"),
  샐러드: asset("Green salad"),
  올리브유: asset("Olive"),
  올리브: asset("Olive"),
  아보카도: asset("Avocado"),

  // Beans / tofu / nuts
  순두부: asset("Beans"),
  연두부: asset("Beans"),
  두부: asset("Beans"),
  콩비지: asset("Beans"),
  렌틸: asset("Beans"),
  병아리콩: asset("Beans"),
  콩: asset("Beans"),
  견과: asset("Peanuts"),
  땅콩: asset("Peanuts"),
  아몬드: asset("Peanuts"),
  호두: asset("Peanuts"),
  잣: asset("Peanuts"),

  // Seaweed
  건미역: asset("Leafy green"),
  미역줄기: asset("Leafy green"),
  미역: asset("Leafy green"),
  조미김: asset("Leafy green"),
  김가루: asset("Leafy green"),
  김밥: asset("Sushi"),
  김: asset("Leafy green"),
  다시마: asset("Leafy green"),

  // Noodles / grains / prepared
  파스타면: asset("Spaghetti"),
  파스타: asset("Spaghetti"),
  스파게티: asset("Spaghetti"),
  우동면: asset("Steaming bowl"),
  우동: asset("Steaming bowl"),
  소면: asset("Steaming bowl"),
  중면: asset("Steaming bowl"),
  당면: asset("Steaming bowl"),
  라면사리: asset("Steaming bowl"),
  열라면: asset("Steaming bowl"),
  라면: asset("Steaming bowl"),
  국수: asset("Steaming bowl"),
  냉면: asset("Steaming bowl"),
  떡볶이떡: asset("Dango"),
  가래떡: asset("Dango"),
  떡: asset("Dango"),
  주먹밥: asset("Rice ball"),
  밥: asset("Cooked rice"),
  쌀: asset("Sheaf of rice"),
  현미: asset("Sheaf of rice"),
  잡곡: asset("Sheaf of rice"),
  카레가루: asset("Curry rice"),
  카레: asset("Curry rice"),
  짜장가루: asset("Cooking"),
  짜장: asset("Cooking"),
  부침가루: asset("Bowl with spoon"),
  밀가루: asset("Bowl with spoon"),
  튀김가루: asset("Bowl with spoon"),
  전분: asset("Bowl with spoon"),
  만두: asset("Dumpling"),
  피자: asset("Pizza"),
  햄버거: asset("Hamburger"),
  샌드위치: asset("Sandwich"),
  타코: asset("Taco"),
  초밥: asset("Sushi"),
  도시락: asset("Bento box"),

  // Fruit
  사과: asset("Red apple"),
  청사과: asset("Green apple"),
  바나나: asset("Banana"),
  딸기: asset("Strawberry"),
  포도씨유: asset("Droplet"),
  포도: asset("Grapes"),
  오렌지: asset("Tangerine"),
  귤: asset("Tangerine"),
  레몬: asset("Lemon"),
  라임: asset("Lemon"),
  수박: asset("Watermelon"),
  멜론: asset("Melon"),
  참외: asset("Melon"),
  파인애플: asset("Pineapple"),
  망고: asset("Mango"),
  복숭아: asset("Peach"),
  자두: asset("Peach"),
  체리: asset("Cherries"),
  블루베리: asset("Blueberries"),
  키위: asset("Kiwi fruit"),
  코코넛: asset("Coconut"),
  배: asset("Pear"),
  과일: asset("Red apple"),

  // Sweets
  아이스크림: asset("Ice cream"),
  초콜릿: asset("Chocolate bar"),
  초코: asset("Chocolate bar"),
  쿠키: asset("Cookie"),
  케이크: asset("Shortcake"),
  도넛: asset("Doughnut"),
  도너츠: asset("Doughnut"),
  파이: asset("Pie"),
  컵케이크: asset("Cupcake"),
  사탕: asset("Candy"),
  캔디: asset("Candy"),
  팝콘: asset("Popcorn"),
  꿀: asset("Honey pot"),
  물엿: asset("Honey pot"),
  올리고당: asset("Honey pot"),
  액상과당: asset("Honey pot"),
  설탕: asset("Candy"),

  // Seasonings / sauces / oils
  마요네즈: asset("Bottle with popping cork"),
  마요: asset("Bottle with popping cork"),
  케첩: asset("Bottle with popping cork"),
  케찹: asset("Bottle with popping cork"),
  데리야끼: asset("Bottle with popping cork"),
  데리야키: asset("Bottle with popping cork"),
  소스: asset("Bottle with popping cork"),
  국간장: asset("Bottle with popping cork"),
  진간장: asset("Bottle with popping cork"),
  간장: asset("Bottle with popping cork"),
  된장: asset("Pot of food"),
  두반장: asset("Pot of food"),
  쌈장: asset("Pot of food"),
  춘장: asset("Pot of food"),
  맛술: asset("Bottle with popping cork"),
  미림: asset("Bottle with popping cork"),
  식초: asset("Bottle with popping cork"),
  들기름: asset("Droplet"),
  참기름: asset("Droplet"),
  식용유: asset("Droplet"),
  카놀라유: asset("Droplet"),
  기름: asset("Droplet"),
  후춧가루: asset("Herb"),
  후추가루: asset("Herb"),
  후추알: asset("Herb"),
  후추: asset("Herb"),
  허브: asset("Herb"),
  바질: asset("Herb"),
  로즈마리: asset("Herb"),
  타임: asset("Herb"),
  파슬리: asset("Herb"),
  고수: asset("Herb"),
  소금: asset("Salt"),
  천일염: asset("Salt"),
  맛소금: asset("Salt"),

  // Broth / drinks / misc
  사골육수: asset("Pot of food"),
  육수: asset("Pot of food"),
  찌개: asset("Pot of food"),
  전골: asset("Pot of food"),
  국: asset("Pot of food"),
  스프: asset("Bowl with spoon"),
  죽: asset("Bowl with spoon"),
  생수: asset("Droplet"),
  탄산수: asset("Droplet"),
  음료: asset("Bubble tea"),
  주스: asset("Bubble tea"),
  커피: asset("Teacup without handle"),
  맥주: asset("Beer mug"),
  와인: asset("Wine glass"),
  통조림: asset("Canned food"),
  캔: asset("Canned food"),
  // Keep short "물" after longer water words; avoid matching 물엿 (handled above)
  물: asset("Droplet"),
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
  조미료: asset("Salt"),
  유제품: asset("Glass of milk"),
  "두부·콩류": asset("Beans"),
  콩류: asset("Beans"),
  곡물: asset("Sheaf of rice"),
  면류: asset("Steaming bowl"),
  빵류: asset("Bread"),
  베이커리: asset("Croissant"),
  음료: asset("Bubble tea"),
  디저트: asset("Shortcake"),
  간식: asset("Cookie"),
  기타: DEFAULT_ICON,
};

function fluentUrl(icon: FluentAsset): string {
  return `${FLUENT_CDN}/${encodeURIComponent(icon.folder)}/Flat/${encodeURIComponent(icon.file)}`;
}

function resolveAsset(
  name: string,
  category: string | null,
): FluentAsset {
  const trimmed = name.trim();
  if (!trimmed) return DEFAULT_ICON;

  if (NAME_ICONS[trimmed]) return NAME_ICONS[trimmed];

  const keys = Object.keys(NAME_ICONS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (trimmed.includes(key)) return NAME_ICONS[key];
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

/** Resolved Fluent folder name (for debugging / audits). */
export function getFoodIconFolder(
  name: string,
  category: string | null = null,
): string {
  return resolveAsset(name, category).folder;
}

/** True when the Takeout-box fallback would be used. */
export function isFoodIconFallback(
  name: string,
  category: string | null = null,
): boolean {
  return resolveAsset(name, category).folder === DEFAULT_ICON.folder;
}

/** @deprecated Prefer FoodIcon component / getFoodIconUrl */
export function getFoodEmoji(name: string, category: string | null): string {
  void name;
  void category;
  return "";
}
