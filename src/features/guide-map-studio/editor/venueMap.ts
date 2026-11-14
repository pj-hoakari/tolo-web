// 案内マップ・スタジオで編集する地図の形（スタジオの中で使う形）。
//  - 会場画像を下敷き（floor.image）にして、その上に「場所・ルート・エリア・テキスト」を描く。
//  - 座標はすべて画像ピクセル（px・左上原点）。
//  - お客さんの画面の案内マップ（src/features/guest/info/guideMapLayout.ts）へは、guideMapIO.ts でその形に変えて渡す。

import {
  type ConnectorDirection,
  type ConnectorType,
  centroidOf,
  DEFAULT_FLOOR_H,
  DEFAULT_FLOOR_W,
  type FloorImage,
  MARKER_SIZE_DEFAULT,
  type PlaceShape,
  type Pt,
} from "@/features/guest/info/guideMapLayout";
import {
  areaPalette,
  buildingAreaOf,
  PLACE_KINDS,
  placeCategory,
} from "@/features/guest/info/guideMapStyle";
// 言語 → 名前（例：{ ja: "受付", en: "Reception" }）。グラフ編集と同じ型
import type { LocalizedLabel } from "@/features/tenant/management/graph/type";

// 点・場所の形・階をまたぐ移動手段・その向き・下敷きの画像の形は、お客さんの画面の案内マップと同じものを使う。
//  - ConnectorType：各階に1つずつ置き、同じ link を持つもの同士が「つながっている」
//  - ConnectorDirection：上り＝floors 配列の後ろの階へ（フロアタブの右側）。エスカレーターの一方通行に使う
//  - FloorImage：下敷きの会場画像（data URL で自己完結。無い場合は白紙＋グリッド）
export type {
  ConnectorDirection,
  ConnectorType,
  FloorImage,
  PlaceShape,
  Pt,
} from "@/features/guest/info/guideMapLayout";
// 図形の計算は tolo-web と同じものを使う
export {
  bboxOf,
  centroidOf,
  distToSegment,
  pointInPolygon,
  toPointsAttr,
} from "@/features/guest/info/guideMapLayout";

// 名前が既定のままかを見分けるための、日本語の呼び名（画面に出す呼び名は useI18n の connectorName）
export const CONNECTOR_LABEL: Record<ConnectorType, string> = {
  stairs: "階段",
  escalator: "エスカレーター",
  elevator: "エレベーター",
};
export const CONNECTOR_TYPES = Object.keys(CONNECTOR_LABEL) as ConnectorType[];
export type ObjectKind = "place" | "route" | "area" | "text";

// groupId＝tolo-web のグラフ（グラフ編集）の「グループ（階）」の ID。tolo-web はこの ID で階を見分け、階の名前もグラフ側の名前を出す
export type Floor = {
  id: string;
  name: string;
  image?: FloorImage;
  groupId?: string;
};

type Base = {
  id: string;
  kind: ObjectKind;
  floor: string;
  title?: string;
  description?: string; // 任意。あればタップで情報カードに表示、無ければ出さない。
  color: string; // パレットキー（PALETTE のいずれか）
  closed?: boolean; // 通行止め（混雑など）。経路探索ではここを通らない／障害物扱いにする。
  graphPointId?: string; // 会場グラフ（tolo-web のグラフ編集）のポイント ID。混雑状況と結び付けて混雑回避ルートに使う
  graphRouteId?: string; // 会場グラフのルート（通路）ID。廊下などのエリア・線に付ける
  locked?: boolean; // 固定（スタジオで動かしたり消したりできないようにする。お客さんの画面には関係しない）
};

// 混雑回避ルート用の混雑の形（お客さんの画面の案内マップと同じ）
export type { CrowdState } from "@/features/guest/info/guideMapLayout";

// 場所（ピン or 図形）＋タイトル・説明（Google マイマップの「場所」相当）
export type PlaceObject = Base & {
  kind: "place";
  x: number;
  y: number;
  shape: PlaceShape;
  w: number; // rect/circle の大きさ（pin では無視）
  h: number;
  pin?: boolean; // rect/circle の中心にピンを付ける（タップで情報カード）
  connector?: ConnectorType; // 階移動ポイント（shape は pin）。無ければ普通の場所
  link?: string; // 同じ値の階移動ポイント同士が階をまたいでつながる
  direction?: ConnectorDirection; // 省略時は both
  markW?: number; // ピン型の階移動マークの幅（px）。四角と同じように縦長・横長にできる
  markH?: number; // ピン型の階移動マークの高さ（px）
};
export type ConnectorObject = PlaceObject & {
  connector: ConnectorType;
  link: string;
};
export const MARKER_SIZE_MIN = 16;
export const MARKER_SIZE_MAX = 400;
/** ピン型の階移動マークの大きさ（中心が x,y の矩形） */
export const markBoxOf = (o: PlaceObject) => ({
  w: o.markW ?? MARKER_SIZE_DEFAULT,
  h: o.markH ?? MARKER_SIZE_DEFAULT,
});
export const isConnector = (o: MapObject): o is ConnectorObject =>
  o.kind === "place" && Boolean(o.connector && o.link);
/** 同じ組（link）の階段・エスカレーター・エレベーターか（各階に置いた分身どうしは同じ link を持つ） */
export const isTwinOf = (o: MapObject, link: string): o is ConnectorObject =>
  isConnector(o) && o.link === link;
// ルート（手描きの折れ線＝道路・順路。Scribble Maps の「線」相当）
export type RouteObject = Base & {
  kind: "route";
  points: Pt[];
  width: number;
  dash: boolean;
};
// エリア／境界線（塗りポリゴン。Scribble Maps の「境界線」・マイマップの「エリア」相当）
export type AreaObject = Base & {
  kind: "area";
  points: Pt[];
};
// テキストラベル
export type TextObject = Base & {
  kind: "text";
  x: number;
  y: number;
  size: number;
};
export type MapObject = PlaceObject | RouteObject | AreaObject | TextObject;

export type VenueMapDoc = {
  version: 1;
  floors: Floor[];
  activeFloorId: string;
  objects: MapObject[];
  north: number; // マップ上向きが指す方位角（度）。0=未設定
  scale: number; // 1px あたりのメートル（0=未設定）
  startId?: string; // 現在地（tolo-web の案内の出発点）にする場所の id。誘導プレビューの「出発」で選ぶ
  graph?: VenueGraph; // 結び付ける tolo-web のグラフ（スタジオの中だけで使う。tolo-web 用の書き出しには入れない）
};

// tolo-web のグラフ（グラフ編集の nodes / edges）から、スタジオで使う分だけ取り出したもの
export type VenueGraph = {
  groups: { id: string; labels: LocalizedLabel }[]; // 階・建物などのまとまり
  points: {
    id: string;
    labels: LocalizedLabel;
    groupId?: string;
    nodeType?: string;
  }[]; // ポイント（場所）
  routes: {
    id: string;
    labels: LocalizedLabel;
    source: string;
    target: string;
  }[]; // ルート（通路）
};

// 作成ツール・ビューで共有する配色パレット（地図らしく色分けできるよう複数色を用意）。
// 場所の種類（マーク）。色の項目（color）にこの値を書き出し、tolo-web はこれで色とアイコンを決める。
// 種類の項目を新しく足すには Graph Authoring・Guest Service の API の変更が要るので、どちらでもそのまま届く色の項目を使う。
export { PLACE_KINDS };
export type PlaceKind = (typeof PLACE_KINDS)[number];
// 以前の色の名前（古いデータ用。色えらびには出さない。tolo-web はこの場所の種類を名前から推し量る）
type LegacyColor =
  | "indigo"
  | "rose"
  | "amber"
  | "emerald"
  | "sky"
  | "violet"
  | "slate";
export type PaletteKey = PlaceKind | LegacyColor | "navy" | "building";
// 男女両方のトイレは、男性（青）と女性（赤）を混ぜた色
const TOILET_MIX = { stroke: "#6e5482", fill: "#9484ae", on: "#ffffff" };
export const PALETTE: Record<
  PaletteKey,
  { label: string; stroke: string; fill: string; on: string }
> = {
  room: {
    label: "基本（グレー）",
    stroke: "#4a5361",
    fill: "#6b7585",
    on: "#ffffff",
  },
  "toilet-men": {
    label: "トイレ（男性）",
    stroke: "#2a6f9e",
    fill: "#4f9fc9",
    on: "#ffffff",
  },
  "toilet-women": {
    label: "トイレ（女性）",
    stroke: "#b23a67",
    fill: "#d96a93",
    on: "#ffffff",
  },
  toilet: { label: "トイレ（男女）", ...TOILET_MIX },
  "toilet-accessible": { label: "多目的トイレ", ...TOILET_MIX },
  food: { label: "飲食", stroke: "#b07500", fill: "#e2a53a", on: "#3a2c00" },
  shop: {
    label: "売店・物販",
    stroke: "#b07500",
    fill: "#e2a53a",
    on: "#3a2c00",
  },
  vending: {
    label: "自販機",
    stroke: "#b07500",
    fill: "#e2a53a",
    on: "#3a2c00",
  },
  rest: {
    label: "休憩・ラウンジ",
    stroke: "#b07500",
    fill: "#e2a53a",
    on: "#3a2c00",
  },
  nursing: {
    label: "授乳室・ベビー",
    stroke: "#b23a67",
    fill: "#d96a93",
    on: "#ffffff",
  },
  "first-aid": {
    label: "救護・医務室",
    stroke: "#b23a67",
    fill: "#d96a93",
    on: "#ffffff",
  },
  info: {
    label: "受付・案内",
    stroke: "#2f7d5b",
    fill: "#4fae82",
    on: "#ffffff",
  },
  locker: {
    label: "ロッカー・クローク",
    stroke: "#4a5361",
    fill: "#6b7585",
    on: "#ffffff",
  },
  charging: {
    label: "充電",
    stroke: "#2a6f9e",
    fill: "#4f9fc9",
    on: "#ffffff",
  },
  smoking: {
    label: "喫煙所",
    stroke: "#4a5361",
    fill: "#6b7585",
    on: "#ffffff",
  },
  entrance: {
    label: "出入口",
    stroke: "#2f7d5b",
    fill: "#4fae82",
    on: "#ffffff",
  },
  meeting: {
    label: "集合場所",
    stroke: "#2f7d5b",
    fill: "#4fae82",
    on: "#ffffff",
  },
  exhibit: {
    label: "展示・催し",
    stroke: "#6b4aa0",
    fill: "#9574c9",
    on: "#ffffff",
  },
  indigo: {
    label: "インディゴ",
    stroke: "#4a5361",
    fill: "#6b7585",
    on: "#ffffff",
  },
  rose: { label: "ローズ", stroke: "#b23a67", fill: "#d96a93", on: "#ffffff" },
  amber: {
    label: "アンバー",
    stroke: "#b07500",
    fill: "#e2a53a",
    on: "#3a2c00",
  },
  emerald: {
    label: "エメラルド",
    stroke: "#2f7d5b",
    fill: "#4fae82",
    on: "#ffffff",
  },
  sky: { label: "スカイ", stroke: "#2a6f9e", fill: "#4f9fc9", on: "#ffffff" },
  violet: {
    label: "バイオレット",
    stroke: "#6b4aa0",
    fill: "#9574c9",
    on: "#ffffff",
  },
  slate: {
    label: "スレート",
    stroke: "#4a5361",
    fill: "#6b7585",
    on: "#ffffff",
  },
  // 基本の色の藍色。tolo-web は知らない色名を藍色（indigo の色）で描くので、どの種類とも被らない
  navy: {
    label: "基本（藍色）",
    stroke: "#3f4691",
    fill: "#646bbd",
    on: "#ffffff",
  },
  // エリアの用途「建物の外枠」。tolo-web は壁として描く。色えらびには出さず、エリアの設定で選ぶ
  building: {
    label: "建物の外枠",
    stroke: "#4a4038",
    fill: "#8a8076",
    on: "#ffffff",
  },
};
// 基本の色（種類の無い普通の部屋の色）。tolo-web で描ける色のうち、種類の色と被らないのはグレーと藍色だけ
export const BASE_COLORS = [
  "room",
  "navy",
] as const satisfies readonly PaletteKey[];
/** 色えらび（種類えらび）に並べるキー */
export const PALETTE_KEYS: PaletteKey[] = [
  ...BASE_COLORS,
  ...PLACE_KINDS.filter((k) => k !== "room"),
];
/** 種類えらびの見出しごとのまとまり（トイレは 1 つにまとめる） */
export const PALETTE_GROUPS: { label: string; keys: PaletteKey[] }[] = [
  { label: "基本の色", keys: [...BASE_COLORS] },
  {
    label: "トイレ",
    keys: ["toilet-men", "toilet-women", "toilet", "toilet-accessible"],
  },
  { label: "飲食・買い物", keys: ["food", "shop", "vending"] },
  {
    label: "休憩・サービス",
    keys: [
      "rest",
      "nursing",
      "first-aid",
      "info",
      "locker",
      "charging",
      "smoking",
    ],
  },
  { label: "出入口・集合", keys: ["entrance", "meeting"] },
  { label: "催し", keys: ["exhibit"] },
];
/** 新しく置く場所の既定の種類 */
export const DEFAULT_COLOR: PaletteKey = "room";
export function paletteOf(key: string) {
  return PALETTE[
    (key as PaletteKey) in PALETTE ? (key as PaletteKey) : DEFAULT_COLOR
  ];
}

// 標準の色（tolo-web は slate・indigo・空を「標準の部屋」とみなし、場所なら名前から種類を推し量る）
const NEUTRAL_COLORS = new Set(["slate", "indigo", ""]);

/** 場所のマーク（tolo-web と同じ決め方。階段・エレベーターと文字・エリアには付けない） */
export function markOf(o: MapObject): PlaceKind {
  return o.kind === "place" && !isConnector(o)
    ? placeCategory(o.title, o.color)
    : "room";
}

/**
 * 色えらびで選ばれて見える色（tolo-web で描かれる色）。
 * 標準の色の場所は名前から推し量った種類、それ以外の標準の色は「基本（グレー）」にする
 */
export function shownColorOf(o: MapObject): PaletteKey {
  if (!NEUTRAL_COLORS.has(o.color))
    return (o.color as PaletteKey) in PALETTE
      ? (o.color as PaletteKey)
      : DEFAULT_COLOR;
  return markOf(o);
}

export const floorSize = (f: Floor | undefined) => ({
  w: f?.image?.w ?? DEFAULT_FLOOR_W,
  h: f?.image?.h ?? DEFAULT_FLOOR_H,
});

// 複数のマップ（エクセルのシートのようなタブ）をまとめて、このブラウザに保存するキー。イベントごとに分ける
export const studioBookKey = (eventId: string) =>
  `guide-map-studio:book:${eventId}`;

// スタジオのタブ1枚分。タブはスタジオの中だけのもので、書き出すのは doc（VenueMapDoc）だけ。
export type StudioPage = { id: string; name: string; doc: VenueMapDoc };
export type StudioBook = { pages: StudioPage[]; activePageId: string };

export const genId = (prefix = "o") =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

/**
 * 読み込んだ地図（ブラウザの保存・ファイル・見本・保存ポイント）を、いまの形に直す。古い書き方はここでだけ扱う。
 *  - markerSize（正方形のマークの大きさ）→ markW / markH
 *  - photo（前の版で入れた写真）は外す
 */
export function normalizeDoc(d: VenueMapDoc): VenueMapDoc {
  type Old = { markerSize?: number; photo?: string };
  if (!d.objects.some((o) => "markerSize" in o || "photo" in o)) return d;
  return {
    ...d,
    objects: d.objects.map((o) => {
      if (!("markerSize" in o || "photo" in o)) return o;
      const { markerSize, photo: _photo, ...rest } = o as MapObject & Old;
      void _photo;
      if (rest.kind !== "place" || markerSize === undefined)
        return rest as MapObject;
      return {
        ...rest,
        markW: rest.markW ?? markerSize,
        markH: rest.markH ?? markerSize,
      };
    }),
  };
}

export function emptyDoc(): VenueMapDoc {
  const floorId = genId("f");
  return {
    version: 1,
    floors: [{ id: floorId, name: "1F" }],
    activeFloorId: floorId,
    objects: [],
    north: 0,
    scale: 0,
  };
}

// 地図の範囲は、お客さんの案内マップと同じ色・同じ描き方にする（guest の guideMapStyle をそのまま使う）
//  - 建物の外枠（用途を「建物の外枠」にした範囲。無ければ場所の半分以上を含むいちばん大きい範囲）は、通路の床の色で塗り、縁を壁にする
//  - それ以外の範囲は、選んだ色の淡い塗りと線
export const MAP_FLOOR = "var(--guest-map-floor)";
export const MAP_WALL = "var(--guest-map-wall)";
// buildingAreaOf は使う項目（kind・points・closed・color・x・y）しか見ず、渡した物をそのまま返すので、スタジオの形でも使える
export const buildingOf = (objects: MapObject[]) =>
  buildingAreaOf(
    objects as unknown as Parameters<typeof buildingAreaOf>[0],
  ) as unknown as AreaObject | undefined;
export { areaPalette };

// 説明を持つか。持つものだけタップで情報カードを出す。
export const hasInfo = (o: MapObject) => Boolean(o.description?.trim());

// 情報カードを出す位置（アンカー）。place=中心やや上、area=重心、route=始点。
export function anchorOf(o: MapObject): Pt {
  if (o.kind === "place")
    return { x: o.x, y: o.shape === "pin" ? o.y - 36 : o.y };
  if (o.kind === "text") return { x: o.x, y: o.y };
  if (o.kind === "route") return o.points[0] ?? { x: 0, y: 0 };
  return centroidOf(o.points); // area
}
