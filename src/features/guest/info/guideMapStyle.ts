/**
 * 案内マップの見た目の決まり（場所の種類・表示名・色）。
 *
 * - 普通の部屋は落ち着いた 1 色（中立色）にそろえ、案内に必要な場所（トイレ・休憩・飲食・救護など）だけを色とアイコンで目立たせる
 * - 場所の種類（マーク）は、案内マップエディタで選んだものを色の項目（color）に入れて受け取る（"toilet-women" など）。
 *   地図は Graph Authoring・Guest Service の API を通り、種類の項目を新しく足すには両方の API の変更が要るため、
 *   どちらでもそのまま届く文字列の色の項目を使う
 * - 種類が入っていない古いデータ（色の名前 "indigo" などのもの）は、名前から種類を推し量る
 */

import {
  type MapObject,
  mapColorOf,
  type Pt,
  pointInPolygon,
} from "./guideMapLayout";

/**
 * 場所の種類（マーク）。案内マップエディタが色の項目にこの値を書く。
 * 並びは案内マップエディタの種類えらびと同じ（トイレはまとめて並べる）
 */
export const PLACE_KINDS = [
  "room",
  // トイレ
  "toilet-men",
  "toilet-women",
  "toilet",
  "toilet-accessible",
  // 飲食・買い物
  "food",
  "shop",
  "vending",
  // 休憩・サービス
  "rest",
  "nursing",
  "first-aid",
  "info",
  "locker",
  "charging",
  "smoking",
  // 出入口・集合
  "entrance",
  "meeting",
  // 催し
  "exhibit",
] as const;
export type PlaceCategory = (typeof PLACE_KINDS)[number];

/** エリアの用途「建物の外枠」を表す色の項目の値 */
export const BUILDING_KIND = "building";

const isKind = (color: string): color is PlaceCategory =>
  (PLACE_KINDS as readonly string[]).includes(color);

// 表示言語によらず当たるよう、対応する 7 言語の言い方を並べる（先に並べたものほど優先）
const TOILET =
  /トイレ|化粧室|お手洗|手洗い|toilet|restroom|washroom|lavatory|wc|화장실|厕所|洗手间|廁所|衛生間|शौचालय|baño|aseo/i;
const ACCESSIBLE =
  /多目的|バリアフリー|だれでも|誰でも|accessible|wheelchair|장애인|무장애|无障碍|無障礙|accesible|अपाङ्ग/i;
const WOMEN = /女|women|woman|female|ladies|여자|여성|mujer|damas|महिला/i;
const MEN = /男|\bmen\b|\bman\b|male|gents|남자|남성|hombre|caballeros|पुरुष/i;
const RULES: [RegExp, PlaceCategory][] = [
  [
    /救護|医務|保健室|応急|first\s?aid|medical|구호|의무실|医务|醫務|急救|primeros auxilios|प्राथमिक उपचार/i,
    "first-aid",
  ],
  [
    /授乳|ベビー|おむつ|nursing|baby|수유|기저귀|哺乳|育婴|育嬰|lactancia|bebé|स्तनपान/i,
    "nursing",
  ],
  [
    /自販機|自動販売機|vending|자판기|自动售货|自動販賣|máquina expendedora/i,
    "vending",
  ],
  [
    /売店|ショップ|物販|グッズ|shop|store|매점|상점|商店|小卖|小賣|tienda|पसल/i,
    "shop",
  ],
  [
    /カフェ|食堂|レストラン|飲食|フード|cafe|café|restaurant|food|canteen|snack|카페|식당|餐厅|咖啡|餐廳|cafetería|comedor|खाना/i,
    "food",
  ],
  [
    /ラウンジ|休憩|lounge|rest\s?area|라운지|휴게|休息|sala de descanso|विश्राम/i,
    "rest",
  ],
  [/喫煙|smoking|흡연|吸烟|吸菸|fumadores|धूम्रपान/i, "smoking"],
  [
    /ロッカー|クローク|荷物預|locker|cloak|사물함|물품보관|储物|置物|寄物|consigna|लकर/i,
    "locker",
  ],
  [/充電|charging|충전|充电|carga|चार्ज/i, "charging"],
  [
    /集合場所|待ち合わせ|meeting\s?point|집합|集合点|集合處|punto de encuentro/i,
    "meeting",
  ],
  [
    /出入口|入口|出口|エントランス|entrance|exit|입구|출구|entrada|salida|प्रवेश/i,
    "entrance",
  ],
  [
    /受付|案内所|インフォメーション|総合案内|職員室|事務|reception|information|\binfo\b|office|안내|접수|교무실|服务台|服務台|问讯|詢問|办公室|辦公室|recepción|oficina|सोधपुछ/i,
    "info",
  ],
];

/**
 * 場所の種類。案内マップエディタで選んだ種類（色の項目）があればそれ、
 * 無ければ名前から推し量る（階移動手段は別扱いなので room のまま）
 */
export function placeCategory(
  name: string | undefined,
  color = "",
): PlaceCategory {
  if (isKind(color)) return color;
  const text = name ?? "";
  if (TOILET.test(text) || ACCESSIBLE.test(text)) {
    if (ACCESSIBLE.test(text)) return "toilet-accessible";
    const women = WOMEN.test(text);
    const men = MEN.test(text);
    if (women && !men) return "toilet-women";
    if (men && !women) return "toilet-men";
    return "toilet";
  }
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "room";
}

export type MapPalette = { fill: string; stroke: string; ink: string };

/** 男女両方が使えるトイレは、男性（青）と女性（赤）を混ぜた色にする */
const TOILET_MIX: MapPalette = {
  fill: "color-mix(in oklch, var(--guest-map-rose-fill), var(--guest-map-sky-fill))",
  stroke:
    "color-mix(in oklch, var(--guest-map-rose-stroke), var(--guest-map-sky-stroke))",
  ink: "color-mix(in oklch, var(--guest-map-rose-ink), var(--guest-map-sky-ink))",
};

/** 種類ごとの色（案内マップエディタのパレットのキー、またはトイレの混ぜた色） */
const CATEGORY_COLOR: Record<
  Exclude<PlaceCategory, "room">,
  string | MapPalette
> = {
  "toilet-men": "sky",
  "toilet-women": "rose",
  toilet: TOILET_MIX,
  "toilet-accessible": TOILET_MIX,
  food: "amber",
  shop: "amber",
  vending: "amber",
  rest: "amber",
  nursing: "rose",
  "first-aid": "rose",
  info: "emerald",
  locker: "slate",
  charging: "sky",
  smoking: "slate",
  entrance: "emerald",
  meeting: "emerald",
  exhibit: "violet",
};

const categoryPalette = (category: Exclude<PlaceCategory, "room">) => {
  const color = CATEGORY_COLOR[category];
  return typeof color === "string" ? mapColorOf(color) : color;
};

/** 「部屋（標準）」とみなす色キー。indigo は以前の既定色なので、これも標準の部屋として扱う */
const NEUTRAL_KEYS = new Set(["slate", "indigo", ""]);

const NEUTRAL: MapPalette = {
  fill: "var(--guest-map-room-fill)",
  stroke: "var(--guest-map-room-stroke)",
  ink: "var(--guest-map-room-ink)",
};

/**
 * 場所の描画色。案内マップエディタで選んだ種類があればその色、
 * 古いデータで標準以外の色名ならその色、標準のままなら名前から推し量った種類の色（普通の部屋は中立色）
 */
export function placePalette(
  color: string,
  category: PlaceCategory,
): MapPalette {
  if (!NEUTRAL_KEYS.has(color) && !isKind(color)) return mapColorOf(color);
  if (category === "room") return NEUTRAL;
  return categoryPalette(category);
}

/** エリア（芝生広場など）の描画色。標準の色・部屋・建物の外枠なら中立色、種類なら種類の色 */
export function areaPalette(color: string): MapPalette {
  if (NEUTRAL_KEYS.has(color) || color === "room" || color === BUILDING_KIND)
    return NEUTRAL;
  if (isKind(color) && color !== "room") return categoryPalette(color);
  return mapColorOf(color);
}

/**
 * 地図に出す名前。全角の英数字（「４０３」など）は字間が空いて間延びするので半角に直す。
 * 表示だけの変換で、データはそのまま
 */
export const displayName = (name: string | undefined) =>
  (name ?? "").normalize("NFKC").trim();

// 名前の末尾によく付く語。2 行に分けるときはこの前で切る
const SUFFIX = /(トイレ|ラウンジ|ホール|ルーム|コーナー|スペース|室|館|口)$/;

/** 1 行に入らない名前を 2 行に分ける（区切り記号・空白・よくある語尾の前、無ければ真ん中で切る） */
export function splitName(name: string): [string, string] {
  const sep = name.search(/[・\s/／-]/);
  if (sep > 0 && sep < name.length - 1)
    return [name.slice(0, sep).trim(), name.slice(sep + 1).trim()];
  const suffix = name.match(SUFFIX);
  if (suffix?.index && suffix.index > 0)
    return [name.slice(0, suffix.index), name.slice(suffix.index)];
  const chars = [...name];
  const half = Math.ceil(chars.length / 2);
  return [chars.slice(0, half).join(""), chars.slice(half).join("")];
}

/** 多角形の面積（建物の外枠を見つけるのに使う） */
function polygonArea(points: Pt[]) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++)
    sum += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  return Math.abs(sum) / 2;
}

/**
 * そのフロアの建物の外枠（壁として描くエリア）。
 * 案内マップエディタで用途を「建物の外枠」にしたエリア（色キー building）があればそれ、
 * 無ければ場所の半分以上を含む、いちばん大きいエリアを外枠とみなす
 */
export function buildingAreaOf(objects: MapObject[]) {
  const areas = objects.filter(
    (o): o is Extract<MapObject, { kind: "area" }> =>
      o.kind === "area" && o.points.length >= 3 && !o.closed,
  );
  const marked = areas.find((a) => a.color === BUILDING_KIND);
  if (marked) return marked;
  const places = objects.filter((o) => o.kind === "place");
  const candidates = areas
    .filter(
      (a) =>
        places.length > 0 &&
        places.filter(
          (p) =>
            p.kind === "place" && pointInPolygon({ x: p.x, y: p.y }, a.points),
        ).length >=
          places.length / 2,
    )
    .sort((a, b) => polygonArea(b.points) - polygonArea(a.points));
  return candidates[0];
}
