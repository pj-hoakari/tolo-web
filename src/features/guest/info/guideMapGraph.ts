import {
  type EdgeDirection,
  type GraphData,
  isPointNode,
  type LocalizedLabel,
  type NodeType,
} from "@/features/tenant/management/graph/type";

export type GuestGuideMapPoint = {
  pointId: string;
  labels: LocalizedLabel;
  nodeType: Exclude<NodeType, "EXTERNAL">;
};

export type GuestGuideMapRoute = {
  routeId: string;
  source: string;
  target: string;
  direction: EdgeDirection;
  label?: string;
};

export type GuestGuideMapGraph = {
  points: GuestGuideMapPoint[];
  routes: GuestGuideMapRoute[];
};

export function toGuestGuideMapGraph(graph: GraphData): GuestGuideMapGraph {
  const points = graph.nodes.flatMap((n): GuestGuideMapPoint[] =>
    isPointNode(n) && n.data.nodeType !== "EXTERNAL"
      ? [{ pointId: n.id, labels: n.data.labels, nodeType: n.data.nodeType }]
      : [],
  );
  const pointIds = new Set(points.map((p) => p.pointId));
  const routes = graph.edges.flatMap((e): GuestGuideMapRoute[] =>
    pointIds.has(e.source) && pointIds.has(e.target)
      ? [
          {
            routeId: e.id,
            source: e.source,
            target: e.target,
            direction: e.data?.direction ?? "both",
            ...(e.data?.label ? { label: e.data.label } : {}),
          },
        ]
      : [],
  );
  return { points, routes };
}
