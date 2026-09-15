/**
 * 会場グラフ（GraphData）を、ゲスト向け案内表示が扱える形へ変換する。
 *
 * 会場グラフは「地点ノード（graph）＋通路エッジ＋フロアのグループ（graphGroup）」で
 * 構成される。地点の座標は所属グループ相対・かつ中心（POINT_NODE_ORIGIN）を指すため、
 * ここで各フロアの左上を足した絶対座標へ直し、SVG にそのまま描ける形にする。
 *
 * ラベルは会場グラフ側の多言語ラベル（LocalizedLabel）を表示ロケールで解決する。
 */

import {
  type GraphData,
  isGroupNode,
  isPointNode,
  type NodeType,
} from "@/features/tenant/management/graph/type";
import { resolveLabel } from "@/features/tenant/management/graph/utils/labels";

/** viewBox の外周に足す余白（ラベルのはみ出し対策） */
const MARGIN = 40;

/** 地点の種別（会場グラフの NodeType をそのまま使う） */
export type GuidePointType = NodeType;

/** 描画する地点（絶対座標・表示ラベル付き） */
export type GuidePoint = {
  id: string;
  label: string;
  /** 表示ロケールにラベルが無く、他言語からフォールバックした場合 true */
  labelIsFallback: boolean;
  x: number;
  y: number;
  /** 所属フロア（グループ）ID。未所属なら空文字 */
  floorId: string;
  type: GuidePointType;
};

/** 描画する通路（地点間の接続） */
export type GuideEdge = {
  id: string;
  from: string;
  to: string;
  /** both: 両通行 / oneway: from→to のみ */
  direction: "both" | "oneway";
  /** 階段・エレベーターなど、通路に添える名称 */
  label?: string;
};

/** フロア（グループ）の枠 */
export type GuideFloor = {
  id: string;
  label: string;
  labelIsFallback: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 案内表示に必要な、会場グラフの変換結果 */
export type GuideGraph = {
  /** SVG viewBox のサイズ */
  width: number;
  height: number;
  floors: GuideFloor[];
  points: GuidePoint[];
  edges: GuideEdge[];
  /** 目的地として選べる地点（GOAL / GOAL_TRANSIT_MIXED） */
  goals: GuidePoint[];
  /** 現在地とみなす地点 ID（入口の BOUNDARY を優先）。無ければ null */
  start: string | null;
};

/** 目的地になり得る種別か */
function isGoalType(type: NodeType): boolean {
  return type === "GOAL" || type === "GOAL_TRANSIT_MIXED";
}

/**
 * 会場グラフを案内表示用モデルへ変換する。
 * @param graph useGraph が返す会場グラフ
 * @param locale 表示ロケール（ラベル解決に使う）
 */
export function buildGuideGraph(graph: GraphData, locale: string): GuideGraph {
  const groups = graph.nodes.filter(isGroupNode);
  const pointNodes = graph.nodes.filter(isPointNode);
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const floors: GuideFloor[] = groups.map((g) => {
    const { text, isFallback } = resolveLabel(g.data.labels, locale);
    return {
      id: g.id,
      label: text,
      labelIsFallback: isFallback,
      x: g.position.x,
      y: g.position.y,
      width: g.width ?? 0,
      height: g.height ?? 0,
    };
  });

  const points: GuidePoint[] = pointNodes.map((p) => {
    // 地点座標は所属フロア相対・中心指定なので、フロア左上を足して絶対座標にする
    const parent = p.parentId ? groupById.get(p.parentId) : undefined;
    const originX = parent?.position.x ?? 0;
    const originY = parent?.position.y ?? 0;
    const { text, isFallback } = resolveLabel(p.data.labels, locale);
    return {
      id: p.id,
      label: text,
      labelIsFallback: isFallback,
      x: originX + p.position.x,
      y: originY + p.position.y,
      floorId: p.parentId ?? "",
      type: p.data.nodeType,
    };
  });

  const pointIds = new Set(points.map((p) => p.id));
  const edges: GuideEdge[] = graph.edges
    // 両端が地点として存在するエッジだけ描く（グループへのエッジ等は無視）
    .filter((e) => pointIds.has(e.source) && pointIds.has(e.target))
    .map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      direction: e.data?.direction ?? "both",
      label: e.data?.label,
    }));

  const goals = points.filter((p) => isGoalType(p.type));

  // 現在地: 入口とみなす BOUNDARY を優先する。
  // 入口はどこかへ出ていく（エッジの source になる）ので、それを手がかりにする。
  const edgeSources = new Set(edges.map((e) => e.from));
  const boundaries = points.filter((p) => p.type === "BOUNDARY");
  const start =
    boundaries.find((b) => edgeSources.has(b.id))?.id ??
    boundaries[0]?.id ??
    points[0]?.id ??
    null;

  const maxX = Math.max(
    0,
    ...floors.map((f) => f.x + f.width),
    ...points.map((p) => p.x),
  );
  const maxY = Math.max(
    0,
    ...floors.map((f) => f.y + f.height),
    ...points.map((p) => p.y),
  );

  return {
    width: maxX + MARGIN,
    height: maxY + MARGIN,
    floors,
    points,
    edges,
    goals,
    start,
  };
}
