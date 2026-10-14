/**
 * 会場マップの統合スキーマ（venueMap.json）と、その読み込み。
 *
 * 従来は「会場グラフ（graph）」と「graphical_info」の 2 ファイルに分かれていたが、
 * フロア定義・地点（ラベル/種別/所属フロア/座標）・通路（接続/方向/曲がり角）を
 * 1 ファイルにまとめた形式。buildVenueNav で既存の NavModel へ変換するので、
 * 経路探索（findPath / routePoints）や表示側はそのまま使える。
 */

import type {
  NavEdge,
  NavModel,
  NavNode,
  NavNodeType,
} from "./graphicalInfoNav";
import { resolveLabel } from "./graphicalInfoNav";

type Vec = { x: number; y: number };
type Shape = "rect" | "circle";

/** 言語コード → 表示名。表示ロケールで解決する */
export type LocalizedLabel = Record<string, string>;

/** フロア（階・建物など）。座標はマップ全体の絶対座標（左上原点） */
export type VenueFloor = {
  id: string;
  /** 任意の単一表示名。labels があればそちらを優先する */
  name?: string;
  labels: LocalizedLabel;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 地点（部屋・経由地点など）。座標は所属フロア相対（中心ではなく左上基準の矩形） */
export type VenuePoint = {
  /** 任意の単一ラベル（後方互換）。labels があればそちらを優先する */
  label?: string;
  labels: LocalizedLabel;
  type: NavNodeType;
  floor: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: Shape;
};

/** 通路（地点間の接続） */
export type VenueRoute = {
  source: string;
  target: string;
  direction: "both" | "oneway";
  label?: string;
  /** 曲がり角（所属フロア相対）。省略可 */
  anchors?: Vec[];
};

/** 会場マップ 1 ファイルの全体形 */
export type VenueMap = {
  version: number;
  /** マップの上が指す方位角（0=北・時計回り） */
  north?: number;
  /** 予約（px→実距離などの係数）。現状は未使用 */
  scale?: number;
  floors: VenueFloor[];
  /** id → 地点 */
  points: Record<string, VenuePoint>;
  /** id → 通路 */
  routes: Record<string, VenueRoute>;
  /** 作成ツールで追加した地点・通路 */
  extraPoints?: (VenuePoint & { id: string })[];
  extraRoutes?: (VenueRoute & { id: string })[];
  areas?: unknown[];
  removedPoints?: string[];
};

/**
 * venueMap（1 ファイル）を、道案内で使う NavModel へ変換する。
 * 地点・曲がり角の座標は「フロア相対」で持つため、所属フロアの左上を足して
 * マップ全体の絶対座標へ直す（フロアが縦に並ぶ）。
 */
export function buildVenueNav(map: VenueMap, locale = "ja"): NavModel {
  const floorById = new Map(map.floors.map((f) => [f.id, f]));

  // フロア相対 → 絶対座標
  const toAbs = (floorId: string, x: number, y: number): Vec => {
    const f = floorById.get(floorId);
    return { x: (f?.x ?? 0) + x, y: (f?.y ?? 0) + y };
  };

  const floors = map.floors.map((f) => ({
    id: f.id,
    name: resolveLabel(f.labels, locale) || f.name || f.id,
  }));

  const pointList = [
    ...Object.entries(map.points).map(([id, p]) => ({ id, ...p })),
    ...(map.extraPoints ?? []),
  ];
  const nodes: NavNode[] = pointList.map((p) => {
    const abs = toAbs(p.floor, p.x, p.y);
    return {
      id: p.id,
      label: resolveLabel(p.labels, locale) || p.label || p.id,
      type: p.type,
      floor: p.floor,
      x: abs.x,
      y: abs.y,
      w: p.w,
      h: p.h,
      shape: p.shape,
    };
  });

  // 曲がり角の座標は端点（source）と同じフロア基準として絶対座標化する
  const floorOf = new Map(nodes.map((n) => [n.id, n.floor]));
  const routeList = [
    ...Object.entries(map.routes).map(([id, r]) => ({ id, ...r })),
    ...(map.extraRoutes ?? []),
  ];
  const edges: NavEdge[] = routeList.map((r) => {
    const floorId = floorOf.get(r.source) ?? "";
    return {
      id: r.id,
      source: r.source,
      target: r.target,
      direction: r.direction,
      label: r.label,
      anchors: (r.anchors ?? []).map((a) => toAbs(floorId, a.x, a.y)),
    };
  });

  const goals = nodes.filter(
    (n) => n.type === "GOAL" || n.type === "GOAL_TRANSIT_MIXED",
  );
  // 出発点の候補（入口・出口などの BOUNDARY を先頭に）
  const starts = [
    ...nodes.filter((n) => n.type === "BOUNDARY"),
    ...nodes.filter((n) => n.type !== "BOUNDARY"),
  ];

  return {
    floors,
    nodes,
    edges,
    north: map.north ?? 0,
    metersPerPx: map.scale ?? 0,
    goals,
    starts,
  };
}
