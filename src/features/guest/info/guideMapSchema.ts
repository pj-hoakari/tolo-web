/**
 * guide-map-poc（マップ作成ツール）から書き出した JSON の型。
 * 座標はすべて px・左上原点で、SVG にそのまま描画できる。
 */

export type GuideMapPoint = { x: number; y: number };

/** フロアをまたぐ移動手段（経由地点として表示する） */
export type GuideMapConnector = "elevator" | "stairs" | "escalator" | "passage";

/** 店舗・区画・経由地点などのカード 1 枚 */
export type GuideMapItem = {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** guide-map-poc のカラーキー（rose / amber / sky など） */
  color: string;
  locked: boolean;
  /** 所属フロア ID。"*" は全フロア共通（経由地点） */
  floor: string;
  /** 設定されていれば経由地点（エレベーター・階段など） */
  connector?: GuideMapConnector;
  shape: "rect" | "circle";
  /** 中心を軸にした回転角（度） */
  rotation: number;
};

export type GuideMapFloor = { id: string; name: string };

/** 確定済みルートの座標列（作成ツール側で選択・手描きした結果） */
export type GuideMapRouteGeometry = {
  key: string;
  floor: string;
  points: GuideMapPoint[];
};

/** 現在地・目的地マーカーの位置（作成ツール側で決めた点） */
export type GuideMapMarkers = {
  start: GuideMapPoint | null;
  end: GuideMapPoint | null;
};

/** マップ全体のスナップショット（書き出し JSON のルート） */
export type GuideMapSnapshot = {
  version: number;
  floors: GuideMapFloor[];
  activeFloorId: string;
  items: GuideMapItem[];
  routeStops: string[];
  routeDash?: string;
  routeSpeed?: string;
  segChoice?: Record<string, number>;
  segTrace?: Record<string, GuideMapPoint[]>;
  routeGeometry?: GuideMapRouteGeometry[];
  /** 現在地・目的地マーカー。無ければカード位置から自動算出する */
  routeMarkers?: GuideMapMarkers;
};

/** 経由地点（connector）は全フロアに存在する */
export const ALL_FLOORS = "*";
