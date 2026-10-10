import type { XYPosition } from "@xyflow/react";
import type { GraphCanvasNode, GraphEdgeType } from "../../type";
import { isPointNode } from "../../type";
import { createNode, EXTERNAL_NODE_ID } from "../graphMutations";
import { sizeOf, withAbsolutePositions } from "../groups";
import { EXTERNAL_CLUSTER_GAP, LAYER_GAP, MEMBER_GAP } from "./constants";

export type ExternalPlacementOptions = {
  clusterGap: number;
  offset: number;
};

export const DEFAULT_EXTERNAL_PLACEMENT_OPTIONS: ExternalPlacementOptions = {
  clusterGap: EXTERNAL_CLUSTER_GAP,
  offset: LAYER_GAP,
};

export type ExternalPlacementInput = {
  aligned: GraphCanvasNode[];
  externals: GraphCanvasNode[];
  externalEdges: GraphEdgeType[];
};

export type ExternalPlacement = {
  externals: GraphCanvasNode[];
  externalEdges: GraphEdgeType[];
};

type Side = "left" | "top" | "right" | "bottom";
type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Boundary = { id: string; side: Side; along: number };
type Cluster = { side: Side; members: Boundary[] };

const SIDE_ORDER: Side[] = ["left", "top", "right", "bottom"];

export function placeExternals(
  { aligned, externals, externalEdges }: ExternalPlacementInput,
  options: Partial<ExternalPlacementOptions> = {},
): ExternalPlacement {
  const { clusterGap, offset } = {
    ...DEFAULT_EXTERNAL_PLACEMENT_OPTIONS,
    ...options,
  };
  const absolute = withAbsolutePositions(aligned);
  if (absolute.length === 0) return { externals, externalEdges };
  const box = boundsOf(absolute);

  const externalIds = new Set(externals.map((n) => n.id));
  const centers = new Map(
    absolute.filter(isPointNode).map((n) => [n.id, n.position]),
  );
  const boundaryIdOf = (edge: GraphEdgeType) => {
    const other = externalIds.has(edge.source) ? edge.target : edge.source;
    return centers.has(other) ? other : undefined;
  };

  const boundaryIds = [
    ...new Set(externalEdges.flatMap((e) => boundaryIdOf(e) ?? [])),
  ];
  if (boundaryIds.length === 0) {
    return {
      externals: placeInRowBelow(externals, box, offset),
      externalEdges,
    };
  }

  const clusters = clusterBySide(
    boundaryIds.flatMap((id) => {
      const center = centers.get(id);
      return center ? [toBoundary(id, center, box)] : [];
    }),
    clusterGap,
  );

  const takenIds = new Set<string>();
  const allIds = new Set([...absolute, ...externals].map((n) => n.id));
  const externalById = new Map(externals.map((n) => [n.id, n]));
  const created: GraphCanvasNode[] = [];
  const placedById = new Map<string, GraphCanvasNode>();
  const clusterIdOfBoundary = new Map<string, string>();

  for (const cluster of clusters) {
    const memberIds = new Set(cluster.members.map((m) => m.id));
    const usage = new Map<string, number>();
    for (const edge of externalEdges) {
      const boundaryId = boundaryIdOf(edge);
      if (!boundaryId || !memberIds.has(boundaryId)) continue;
      const externalId = boundaryId === edge.source ? edge.target : edge.source;
      usage.set(externalId, (usage.get(externalId) ?? 0) + 1);
    }
    const id =
      [...usage]
        .filter(([candidate]) => !takenIds.has(candidate))
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0]?.[0] ??
      [...externalIds].sort().find((candidate) => !takenIds.has(candidate)) ??
      freshId(cluster.members[0].id, allIds);
    takenIds.add(id);
    allIds.add(id);

    const base =
      externalById.get(id) ??
      createNode({
        id,
        labels: {},
        nodeType: "EXTERNAL",
        position: { x: 0, y: 0 },
      });
    const placed: GraphCanvasNode = {
      ...base,
      parentId: undefined,
      position: positionFor(cluster, sizeOf(base), box, offset),
    };
    placedById.set(id, placed);
    if (!externalById.has(id)) created.push(placed);
    for (const memberId of memberIds) clusterIdOfBoundary.set(memberId, id);
  }

  return {
    externals: [
      ...externals.flatMap((n) => placedById.get(n.id) ?? []),
      ...created,
    ],
    externalEdges: externalEdges.map((edge) => {
      const boundaryId = boundaryIdOf(edge);
      const id = boundaryId && clusterIdOfBoundary.get(boundaryId);
      if (!id) return edge;
      return boundaryId === edge.source
        ? { ...edge, target: id }
        : { ...edge, source: id };
    }),
  };
}

function boundsOf(nodes: GraphCanvasNode[]): Box {
  const rects = nodes.map((n) => {
    const { width, height } = sizeOf(n);
    const x = isPointNode(n) ? n.position.x - width / 2 : n.position.x;
    const y = isPointNode(n) ? n.position.y - height / 2 : n.position.y;
    return { x, y, width, height };
  });
  return {
    minX: Math.min(...rects.map((r) => r.x)),
    minY: Math.min(...rects.map((r) => r.y)),
    maxX: Math.max(...rects.map((r) => r.x + r.width)),
    maxY: Math.max(...rects.map((r) => r.y + r.height)),
  };
}

function toBoundary(id: string, center: XYPosition, box: Box): Boundary {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const distances: [Side, number][] = [
    ["left", (center.x - box.minX) / width],
    ["right", (box.maxX - center.x) / width],
    ["top", (center.y - box.minY) / height],
    ["bottom", (box.maxY - center.y) / height],
  ];
  const [side] = distances.reduce((best, d) => (d[1] < best[1] ? d : best));
  const along = side === "left" || side === "right" ? center.y : center.x;
  return { id, side, along };
}

function clusterBySide(boundaries: Boundary[], gap: number): Cluster[] {
  return SIDE_ORDER.flatMap((side) => {
    const sorted = boundaries
      .filter((b) => b.side === side)
      .sort((a, b) => a.along - b.along || a.id.localeCompare(b.id));
    const clusters: Cluster[] = [];
    for (const boundary of sorted) {
      const last = clusters.at(-1);
      const prev = last?.members.at(-1);
      if (last && prev && boundary.along - prev.along <= gap) {
        last.members.push(boundary);
      } else {
        clusters.push({ side, members: [boundary] });
      }
    }
    return clusters;
  });
}

function positionFor(
  cluster: Cluster,
  size: { width: number; height: number },
  box: Box,
  offset: number,
): XYPosition {
  const alongs = cluster.members.map((m) => m.along);
  const mid = (Math.min(...alongs) + Math.max(...alongs)) / 2;
  const position = {
    left: { x: box.minX - offset - size.width / 2, y: mid },
    right: { x: box.maxX + offset + size.width / 2, y: mid },
    top: { x: mid, y: box.minY - offset - size.height / 2 },
    bottom: { x: mid, y: box.maxY + offset + size.height / 2 },
  }[cluster.side];
  return { x: Math.round(position.x), y: Math.round(position.y) };
}

function freshId(boundaryId: string, usedIds: ReadonlySet<string>): string {
  const base = `${EXTERNAL_NODE_ID}-${boundaryId}`;
  if (!usedIds.has(base)) return base;
  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

function placeInRowBelow(
  externals: GraphCanvasNode[],
  box: Box,
  offset: number,
): GraphCanvasNode[] {
  const widths = externals.map((n) => sizeOf(n).width);
  const total =
    widths.reduce((sum, w) => sum + w, 0) +
    MEMBER_GAP * Math.max(0, externals.length - 1);
  let left = (box.minX + box.maxX) / 2 - total / 2;
  return externals.map((n, i) => {
    const x = left + widths[i] / 2;
    left += widths[i] + MEMBER_GAP;
    return {
      ...n,
      parentId: undefined,
      position: {
        x: Math.round(x),
        y: Math.round(box.maxY + offset + sizeOf(n).height / 2),
      },
    };
  });
}
