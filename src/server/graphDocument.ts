import { create } from "@bufbuild/protobuf";
import {
  EdgeDirection,
  type GraphDocument,
  GraphDocumentSchema,
  type NodeGroup,
  NodeType,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import {
  type GraphCanvasNode,
  type GraphData,
  type EdgeDirection as GraphEdgeDirection,
  type NodeType as GraphNodeType,
  isGroupNode,
  isPointNode,
} from "@/features/tenant/management/graph/type";
import {
  GROUP_DEFAULT_HEIGHT,
  GROUP_DEFAULT_WIDTH,
} from "@/features/tenant/management/graph/utils/groups";

const NODE_TYPES: Record<GraphNodeType, NodeType> = {
  GOAL: NodeType.GOAL,
  GOAL_TRANSIT_MIXED: NodeType.GOAL_TRANSIT_MIXED,
  TRANSIT_ONLY: NodeType.TRANSIT_ONLY,
  EXTERNAL: NodeType.EXTERNAL,
};

const EDGE_DIRECTIONS: Record<GraphEdgeDirection, EdgeDirection> = {
  oneway: EdgeDirection.ONE_WAY,
  both: EdgeDirection.BOTH_WAYS,
};

function invert<K extends string, V extends number>(
  table: Record<K, V>,
): (value: V) => K {
  const inverted = new Map(
    Object.entries(table).map(([k, v]) => [v as V, k as K]),
  );
  return (value) => {
    const key = inverted.get(value);
    if (key === undefined) throw new Error(`unexpected enum value ${value}`);
    return key;
  };
}

const nodeTypeOf = invert(NODE_TYPES);
const directionOf = invert(EDGE_DIRECTIONS);

export function toGraphDocument(graph: GraphData): GraphDocument {
  return create(GraphDocumentSchema, {
    groups: graph.nodes.filter(isGroupNode).map((g) => ({
      groupId: g.id,
      labels: g.data.labels,
      layout: {
        x: g.position.x,
        y: g.position.y,
        width: g.width,
        height: g.height,
      },
      parentGroupId: g.parentId ?? "",
      minWidth: g.data.minWidth,
      minHeight: g.data.minHeight,
    })),
    nodes: graph.nodes.filter(isPointNode).map((n) => ({
      nodeId: n.id,
      nodeType: NODE_TYPES[n.data.nodeType],
      labels: n.data.labels,
      groupId: n.parentId ?? "",
      layout: { x: n.position.x, y: n.position.y },
    })),
    edges: graph.edges.map((e) => ({
      edgeId: e.id,
      sourceNodeId: e.source,
      targetNodeId: e.target,
      direction: EDGE_DIRECTIONS[e.data?.direction ?? "both"],
      label: e.data?.label,
    })),
  });
}

function parentsFirst(groups: NodeGroup[]): NodeGroup[] {
  const byId = new Map(groups.map((g) => [g.groupId, g]));
  const seen = new Set<string>();
  const ordered: NodeGroup[] = [];
  const visit = (group: NodeGroup) => {
    if (seen.has(group.groupId)) return;
    seen.add(group.groupId);
    const parent = byId.get(group.parentGroupId);
    if (parent) visit(parent);
    ordered.push(group);
  };
  groups.forEach(visit);
  return ordered;
}

const parentOf = (id: string) => (id ? { parentId: id } : {});

export function fromGraphDocument(document: GraphDocument): GraphData {
  const groups: GraphCanvasNode[] = parentsFirst(document.groups).map((g) => ({
    id: g.groupId,
    type: "graphGroup",
    position: { x: g.layout?.x ?? 0, y: g.layout?.y ?? 0 },
    ...parentOf(g.parentGroupId),
    width: g.layout?.width ?? GROUP_DEFAULT_WIDTH,
    height: g.layout?.height ?? GROUP_DEFAULT_HEIGHT,
    data: {
      labels: { ...g.labels },
      ...(g.minWidth !== undefined ? { minWidth: g.minWidth } : {}),
      ...(g.minHeight !== undefined ? { minHeight: g.minHeight } : {}),
    },
  }));
  const points: GraphCanvasNode[] = document.nodes.map((n) => ({
    id: n.nodeId,
    type: "graph",
    position: { x: n.layout?.x ?? 0, y: n.layout?.y ?? 0 },
    ...parentOf(n.groupId),
    data: { labels: { ...n.labels }, nodeType: nodeTypeOf(n.nodeType) },
  }));
  return {
    nodes: [...groups, ...points],
    edges: document.edges.map((e) => ({
      id: e.edgeId,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: "graph",
      data: {
        direction: directionOf(e.direction),
        ...(e.label !== undefined ? { label: e.label } : {}),
      },
    })),
  };
}
