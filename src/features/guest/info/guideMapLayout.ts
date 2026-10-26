/**
 * 案内マップの共通スキーマ（guide-map-poc の「案内マップエディタ」が書き出す JSON）。
 * 案内マップエディタ側の lib/venue-map.ts と同じ形。座標はすべて px・左上原点。
 *
 * - 四角・丸の場所（部屋・屋台）は「壁」、そのすき間が「歩ける道」になる
 * - 階段・エスカレーター・エレベーターは各階に 1 つずつ置き、同じ link 同士が階をまたいでつながる
 */

import type { LocalizedLabel } from "@/features/tenant/management/graph/type";
import { resolveLabel } from "@/features/tenant/management/graph/utils/labels";

export type Pt = { x: number; y: number };

export type PlaceShape = "pin" | "rect" | "circle";
/** 階をまたぐ移動手段 */
export type ConnectorType = "stairs" | "escalator" | "elevator";
/** 上り＝groups 配列の後ろの階へ。エスカレーターの一方通行に使う */
export type ConnectorDirection = "both" | "up" | "down";

/** 下敷きの会場画像（data URL で自己完結） */
export type FloorImage = { src: string; w: number; h: number };
export type GuideMapLayoutGroup = { groupId: string; image?: FloorImage };

type Base = {
  id: string;
  groupId: string;
  title?: string;
  description?: string;
  photo?: string;
  /** パレットキー（PALETTE_KEYS のいずれか） */
  color: string;
  /** 通行止め。経路探索では通らない */
  closed?: boolean;
  /** グラフ（グラフ編集）のポイント ID。混雑状況と結び付けて混雑回避ルートに使う */
  pointId?: string;
  /** グラフのルート（通路）ID。廊下などのエリア・線に付ける */
  routeId?: string;
};

export type PlaceObject = Base & {
  kind: "place";
  /** 中心座標 */
  x: number;
  y: number;
  shape: PlaceShape;
  /** rect / circle の大きさ（pin では無視） */
  w: number;
  h: number;
  /** rect / circle の中心にピンを付ける */
  pin?: boolean;
  /** 階移動手段ならその種類 */
  connector?: ConnectorType;
  /** 同じ値の階移動手段同士が階をまたいでつながる */
  link?: string;
  direction?: ConnectorDirection;
  /** ピン型の階移動マークの幅・高さ（px） */
  markW?: number;
  markH?: number;
  /** （旧）ピン型の階移動マークの正方形の大きさ。markW / markH が無いときだけ使う */
  markerSize?: number;
};
export type ConnectorObject = PlaceObject & {
  connector: ConnectorType;
  link: string;
};
export type LineObject = Base & {
  kind: "line";
  points: Pt[];
  width: number;
  dash: boolean;
};
export type AreaObject = Base & { kind: "area"; points: Pt[] };
export type TextObject = Base & {
  kind: "text";
  x: number;
  y: number;
  size: number;
};
export type MapObject = PlaceObject | LineObject | AreaObject | TextObject;

export type GuideMapLayout = {
  version: 1;
  groups: GuideMapLayoutGroup[];
  objects: MapObject[];
  /** マップ上向きが指す方位角（度）。0=未設定 */
  north: number;
  /** 1px あたりのメートル（0=未設定） */
  scale: number;
  /** 既定の出発地にする場所の id（QR の設置箇所から現在地が決まらないときに使う）。案内マップエディタの経路プレビューで「出発」に選んだ場所 */
  startId?: string;
};

type Localized<T> = T extends unknown
  ? Omit<T, "title" | "description"> & {
      title?: LocalizedLabel;
      description?: LocalizedLabel;
    }
  : never;

export type LocalizedMapObject = Localized<MapObject>;

export type LocalizedGuideMapLayout = Omit<GuideMapLayout, "objects"> & {
  objects: LocalizedMapObject[];
};

export function localizeGuideMapLayout(
  layout: LocalizedGuideMapLayout,
  pointLabels: ReadonlyMap<string, LocalizedLabel>,
  locale: string,
): GuideMapLayout {
  const textOf = (labels: LocalizedLabel | undefined) =>
    (labels && resolveLabel(labels, locale).text) || undefined;
  return {
    ...layout,
    objects: layout.objects.map(
      (o) =>
        ({
          ...o,
          title:
            textOf(o.pointId ? pointLabels.get(o.pointId) : undefined) ??
            textOf(o.title),
          description: textOf(o.description),
        }) as MapObject,
    ),
  };
}

/** 混雑回避ルート用の混雑（Guest Service の混雑状況と同じ段階） */
export type CrowdLevel = "low" | "mid" | "high";
export type CrowdState = { level: CrowdLevel; danger: boolean };
/** オブジェクト id → 混雑 */
export type CrowdMap = ReadonlyMap<string, CrowdState>;
/** 混雑状況の 1 件（id は "pointId:<グラフのポイント ID>" または "routeId:<グラフのルート ID>"） */
export type CrowdEntry = { id: string; level: CrowdLevel; danger: boolean };

/** 混雑状況を、グラフ ID で結び付けた地図のオブジェクトごとに引き直す（1 つのグラフ ID に複数のオブジェクトを結び付けられる） */
export function crowdByObject(
  objects: MapObject[],
  crowd: readonly CrowdEntry[],
): Map<string, CrowdState> {
  const byGraph = new Map(
    crowd.map((c) => [c.id, { level: c.level, danger: c.danger }]),
  );
  const out = new Map<string, CrowdState>();
  for (const o of objects) {
    const s =
      (o.pointId && byGraph.get(`pointId:${o.pointId}`)) ||
      (o.routeId && byGraph.get(`routeId:${o.routeId}`));
    if (s) out.set(o.id, s);
  }
  return out;
}

export const isConnector = (o: MapObject): o is ConnectorObject =>
  o.kind === "place" && Boolean(o.connector && o.link);

/** 案内マップエディタでのピン型の階移動マークの既定の大きさ（px）。経路探索で壁として使う */
export const MARKER_SIZE_DEFAULT = 28;

/**
 * ピン型の階移動マークの大きさ（中心が x,y の矩形）。
 * 案内マップエディタで大きさを指定していなければ fallback（スマホで押せる既定の大きさ）を使う。
 */
export const markBoxOf = (o: PlaceObject, fallback: number) => ({
  w: o.markW ?? o.markerSize ?? fallback,
  h: o.markH ?? o.markerSize ?? fallback,
});

/** 目的地として選べる場所（名前のある部屋・ピン。階移動手段は除く） */
export const isDestination = (o: MapObject): o is PlaceObject =>
  o.kind === "place" && !isConnector(o) && Boolean(o.title?.trim());

/** 案内マップエディタの色キー（パレット）。データ側はこのいずれかを color に持つ */
export const PALETTE_KEYS = [
  "indigo",
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
  "slate",
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

/**
 * 色キー → 地図の描画色（CSS 変数）。
 * 案内マップエディタの原色そのままだとゲスト画面の落ち着いた配色から浮くため、
 * ゲストテーマ（ライト / ダーク）に合わせたトーンを globals.css の --guest-map-* で持つ。
 * 未知のキーは indigo 扱い。
 */
export function mapColorOf(key: string) {
  const k = (PALETTE_KEYS as readonly string[]).includes(key) ? key : "indigo";
  return {
    fill: `var(--guest-map-${k}-fill)`,
    stroke: `var(--guest-map-${k}-stroke)`,
    ink: `var(--guest-map-${k}-ink)`,
  };
}

/** フロアの広さ（下敷き画像があればその大きさ、無ければ既定の白紙） */
export const DEFAULT_FLOOR_W = 1200;
export const DEFAULT_FLOOR_H = 800;
export const floorSize = (f: GuideMapLayoutGroup | undefined) => ({
  w: f?.image?.w ?? DEFAULT_FLOOR_W,
  h: f?.image?.h ?? DEFAULT_FLOOR_H,
});

export function bboxOf(points: Pt[]) {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export type Rect = { x: number; y: number; w: number; h: number };

/** ピンの上の名前や下のラベルまで含めて見せるための余白 */
const PIN_REACH = { up: 96, down: 48, side: 60 };
/** 中身のまわりに足す余白 */
const CONTENT_MARGIN = 48;

/**
 * オブジェクトが描かれる範囲（名前・ラベルの張り出しも含む）。
 * 下敷き画像の無いフロアは白紙の広さが仮の値なので、この範囲だけを地図として見せる。
 */
export function contentBounds(objects: MapObject[]): Rect | null {
  const pts: Pt[] = [];
  for (const o of objects) {
    if (o.kind === "area" || o.kind === "line") pts.push(...o.points);
    else if (o.kind === "text") {
      const half = (o.title?.length ?? 0) * o.size * 0.6;
      pts.push(
        { x: o.x - half, y: o.y - o.size },
        { x: o.x + half, y: o.y + o.size },
      );
    } else if (o.shape === "pin" && o.connector) {
      const { w, h } = markBoxOf(o, 0);
      pts.push(
        {
          x: o.x - Math.max(w / 2, PIN_REACH.side),
          y: o.y - h / 2 - PIN_REACH.down,
        },
        {
          x: o.x + Math.max(w / 2, PIN_REACH.side),
          y: o.y + h / 2 + PIN_REACH.down,
        },
      );
    } else if (o.shape === "pin") {
      pts.push(
        { x: o.x - PIN_REACH.side, y: o.y - PIN_REACH.up },
        { x: o.x + PIN_REACH.side, y: o.y + PIN_REACH.down },
      );
    } else {
      pts.push(
        { x: o.x - o.w / 2, y: o.y - o.h / 2 - PIN_REACH.down },
        { x: o.x + o.w / 2, y: o.y + o.h / 2 + PIN_REACH.down },
      );
    }
  }
  if (pts.length === 0) return null;
  const box = bboxOf(pts);
  return {
    x: box.x - CONTENT_MARGIN,
    y: box.y - CONTENT_MARGIN,
    w: box.w + CONTENT_MARGIN * 2,
    h: box.h + CONTENT_MARGIN * 2,
  };
}

export function centroidOf(points: Pt[]): Pt {
  if (points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/** 折れ線を SVG の points 文字列にする */
export const toPointsAttr = (points: Pt[]) =>
  points.map((p) => `${p.x},${p.y}`).join(" ");

/** 点 p と線分 a–b の距離 */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 点がポリゴン内部か */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
