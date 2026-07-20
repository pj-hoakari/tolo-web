/**
 * guide-map-poc の書き出し JSON を GuideMapView が扱える形へ変換する。
 * 道は「作成ツールで指定したもの」をそのまま描くことを基本とする。
 */

import type { GuideMapRoom, GuideMapWaypoint, MapPoint } from "./GuideMapView";
import { computeRoute } from "./guideMapRoute";
import {
  ALL_FLOORS,
  type GuideMapItem,
  type GuideMapSnapshot,
} from "./guideMapSchema";

/** 経路探索のグリッド単位（guide-map-poc と揃える） */
const GRID_SIZE = 24;
/** マップ外周の余白 */
const MAP_MARGIN = 24;

/** guide-map-poc のカラーキー → ゲストテーマの淡いタイント */
const COLOR_FILL: Record<string, string> = {
  rose: "fill-guest-room-rose",
  pink: "fill-guest-room-rose",
  orange: "fill-guest-room-amber",
  amber: "fill-guest-room-amber",
  lime: "fill-guest-room-sage",
  emerald: "fill-guest-room-sage",
  cyan: "fill-guest-room-sky",
  sky: "fill-guest-room-sky",
  violet: "fill-guest-room-sky",
};

const centerOf = (item: GuideMapItem): MapPoint => ({
  x: item.x + item.w / 2,
  y: item.y + item.h / 2,
});

/** 指定フロアに表示するカードか（経由地点は全フロア共通） */
const onFloor = (item: GuideMapItem, floorId: string) =>
  item.floor === floorId || item.floor === ALL_FLOORS;

/** 表示名を解決する（i18n があれば優先し、無ければ JSON のタイトル） */
export type ResolveLabel = (id: string, fallback: string) => string;

export type GuideMapSource = {
  width: number;
  height: number;
  rooms: GuideMapRoom[];
  waypoints: GuideMapWaypoint[];
};

/** カードの外接矩形からマップの描画サイズ（viewBox）を求める */
function measure(items: GuideMapItem[]) {
  if (items.length === 0) return { width: 320, height: 240 };
  const maxX = Math.max(...items.map((i) => i.x + i.w));
  const maxY = Math.max(...items.map((i) => i.y + i.h));
  return { width: maxX + MAP_MARGIN, height: maxY + MAP_MARGIN };
}

/** JSON から、そのフロアの部屋・経由地点を組み立てる */
export function buildGuideMapSource(
  snapshot: GuideMapSnapshot,
  floorId: string,
  resolveLabel: ResolveLabel = (_id, fallback) => fallback,
): GuideMapSource {
  const visible = snapshot.items.filter((item) => onFloor(item, floorId));
  const { width, height } = measure(visible);

  const rooms: GuideMapRoom[] = visible
    .filter((item) => !item.connector)
    .map((item) => ({
      id: item.id,
      label: resolveLabel(item.id, item.title),
      x: item.x,
      y: item.y,
      width: item.w,
      height: item.h,
      fill: COLOR_FILL[item.color] ?? "fill-secondary",
      shape: item.shape,
      rotation: item.rotation,
    }));

  const waypoints: GuideMapWaypoint[] = visible
    .filter((item) => !!item.connector)
    .map((item) => ({
      id: item.id,
      label: resolveLabel(item.id, item.title),
      point: centerOf(item),
    }));

  return { width, height, rooms, waypoints };
}

/** 作成ツールの「破線の長さ」→ アニメーション用クラス */
const DASH_CLASS: Record<string, string> = {
  short: "route-flow-short",
  normal: "route-flow-normal",
  long: "route-flow-long",
};

/** 作成ツールの「流れる速さ」→ animation-duration */
const SPEED_DURATION: Record<string, string> = {
  slow: "1.8s",
  normal: "1.1s",
  fast: "0.6s",
};

/** 作成ツールで設定した線の見た目（流れる破線）を再現するための指定 */
export function resolveRouteFlow(snapshot: GuideMapSnapshot) {
  const dash = DASH_CLASS[snapshot.routeDash ?? "normal"] ?? DASH_CLASS.normal;
  const duration =
    SPEED_DURATION[snapshot.routeSpeed ?? "normal"] ?? SPEED_DURATION.normal;
  return { className: `route-flow ${dash}`, duration };
}

/** マーカーをカード中心からずらす割合（店名ラベルとの重なり回避） */
const MARKER_OFFSET_RATIO = 0.25;

const findItem = (snapshot: GuideMapSnapshot, id: string | undefined) =>
  id ? snapshot.items.find((item) => item.id === id) : undefined;

/**
 * 現在地・目的地マーカーの位置。
 * 作成ツールが JSON に書き出していればそれを使い、
 * 無ければカード中心から少しずらした位置を自動で求める
 * （現在地は下へ、目的地は上へずらして店名ラベルとの重なりを避ける）。
 */
export function resolveMarkers(
  snapshot: GuideMapSnapshot,
  fallbackStart: MapPoint,
): { start: MapPoint; end: MapPoint | null } {
  const explicit = snapshot.routeMarkers;
  const startItem = findItem(snapshot, snapshot.routeStops?.[0]);
  const endItem = findItem(snapshot, snapshot.routeStops?.at(-1));

  const start =
    explicit?.start ??
    (startItem
      ? {
          x: centerOf(startItem).x,
          y: centerOf(startItem).y + startItem.h * MARKER_OFFSET_RATIO,
        }
      : fallbackStart);

  const end =
    explicit?.end ??
    (endItem
      ? {
          x: centerOf(endItem).x,
          y: centerOf(endItem).y - endItem.h * MARKER_OFFSET_RATIO,
        }
      : null);

  return { start, end };
}

/**
 * 作成ツールで確定済みのルート（候補選択・手描きの結果）を取り出す。
 * 経由がある場合は区間が分かれているので、順につないで 1 本の折れ線にする。
 */
function exportedRoute(
  snapshot: GuideMapSnapshot,
  floorId: string,
): MapPoint[] | null {
  const segments = (snapshot.routeGeometry ?? []).filter(
    (geometry) => geometry.floor === floorId,
  );
  if (segments.length === 0) return null;

  const points: MapPoint[] = [];
  for (const segment of segments) {
    for (const point of segment.points) {
      const last = points.at(-1);
      // 区間のつなぎ目で同じ点が重複するのを避ける
      if (last && last.x === point.x && last.y === point.y) continue;
      points.push(point);
    }
  }
  return points.length >= 2 ? points : null;
}

/**
 * 表示する 1 本の道を返す。
 * 作成ツールで確定したルートがあればそのまま使い、
 * 無い場合だけ「出発 → 目的」を経路探索で補う。
 */
export function buildRoute(
  snapshot: GuideMapSnapshot,
  floorId: string,
  start: MapPoint,
  end: MapPoint | null,
  width: number,
  height: number,
): MapPoint[] {
  // 1) 作成ツールで作った線をそのまま採用する（両端はマーカー位置に合わせる）
  const exported = exportedRoute(snapshot, floorId);
  if (exported) {
    const middle = exported.slice(1, -1);
    return [start, ...middle, end ?? exported[exported.length - 1]];
  }

  // 2) 確定ルートが無ければ、指定された目的地まで探索する
  const destinationId = snapshot.routeStops?.at(-1);
  if (!destinationId) return [];

  const visible = snapshot.items.filter((item) => onFloor(item, floorId));
  const destination = visible.find((item) => item.id === destinationId);
  if (!destination) return [];

  const obstacles = visible
    .filter((item) => item.id !== destination.id)
    .map((item) => ({ x: item.x, y: item.y, w: item.w, h: item.h }));
  return computeRoute(
    obstacles,
    start,
    end ?? centerOf(destination),
    width,
    height,
    GRID_SIZE,
  );
}
