// 案内マップ・スタジオで編集する地図の処理（パレット・正規化・階段などの判定・見本）。地図の形（型）は type.ts

import {
  centroidOf,
  DEFAULT_FLOOR_H,
  DEFAULT_FLOOR_W,
  MARKER_SIZE_DEFAULT,
} from "@/features/guest/info/guideMapLayout";
import {
  areaPalette,
  buildingAreaOf,
  PLACE_KINDS,
  placeCategory,
} from "@/features/guest/info/guideMapStyle";
import type {
  AreaObject,
  ConnectorObject,
  ConnectorType,
  Floor,
  GuideMapDoc,
  MapObject,
  PaletteKey,
  PlaceKind,
  PlaceObject,
  Pt,
} from "../type";

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

export const MARKER_SIZE_MIN = 16;
export const MARKER_SIZE_MAX = 400;
/** ピン型の階移動マークの大きさ（中心が x,y の矩形） */
export const markBoxOf = (o: PlaceObject) => ({
  w: o.markW ?? MARKER_SIZE_DEFAULT,
  h: o.markH ?? MARKER_SIZE_DEFAULT,
});
export const isConnector = (o: MapObject): o is ConnectorObject =>
  o.kind === "place" && Boolean(o.connector && o.link);
/**
 * 誘導グラフ（tolo-web のグラフ）のポイントに結び付けておくべき物か。
 * 地図は全部（部屋・範囲・文字など）を持ち、誘導グラフは道のつながり（ルート図）として、混雑や位置を受け取る所だけを持つ。
 * 階段・エレベーター・エスカレーターは階をまたぐ道なので必須。部屋は地図の名前だけで目的地に選べるので、
 * 行列や混雑を測る部屋だけを結び付ければよい（地図からは分からないので任意）
 */
export const needsGraphPoint = (o: MapObject) => isConnector(o);
/** 同じ組（link）の階段・エスカレーター・エレベーターか（各階に置いた分身どうしは同じ link を持つ） */
export const isTwinOf = (o: MapObject, link: string): o is ConnectorObject =>
  isConnector(o) && o.link === link;

// 作成ツール・ビューで共有する配色パレット（地図らしく色分けできるよう複数色を用意）。
// 場所の種類（マーク）。色の項目（color）にこの値を書き出し、tolo-web はこれで色とアイコンを決める。
// 種類の項目を新しく足すには Graph Authoring・Guest Service の API の変更が要るので、どちらでもそのまま届く色の項目を使う。
export { PLACE_KINDS };

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

export const genId = (prefix = "o") =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

/**
 * 読み込んだ地図（ブラウザの保存・ファイル・見本・保存ポイント）を、いまの形に直す。古い書き方はここでだけ扱う。
 *  - markerSize（正方形のマークの大きさ）→ markW / markH
 *  - photo（前の版で入れた写真）は外す
 *  - 範囲の名前と名前の大きさ（範囲には名前を付けなくなった）は外す
 */
export function normalizeDoc(d: GuideMapDoc): GuideMapDoc {
  type Old = { markerSize?: number; photo?: string };
  const old = (o: MapObject) =>
    "markerSize" in o ||
    "photo" in o ||
    (o.kind === "area" && ("title" in o || "labelScale" in o));
  if (!d.objects.some(old)) return d;
  return {
    ...d,
    objects: d.objects.map((o) => {
      if (!old(o)) return o;
      if (o.kind === "area") {
        const { title: _title, labelScale: _labelScale, ...area } = o;
        void _title;
        void _labelScale;
        return area;
      }
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

export function emptyDoc(): GuideMapDoc {
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
