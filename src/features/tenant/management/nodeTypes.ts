import type {
  EdgeDirection,
  GraphEdgeType,
  GraphNodeType,
  NodeType,
} from "./type";

export type NodeRole = "in" | "out";

/**
 * タイプ制約の検証に渡すコンテキスト
 */
export type NodeValidationContext = {
  nodeId: string;
  roles: ReadonlySet<NodeRole>;
  /** グラフ全体のノード */
  nodes: GraphNodeType[];
  /** 検証対象のエッジ集合 */
  edges: GraphEdgeType[];
};

export type NodeTypeConstraint = {
  message: string;
  validate: (ctx: NodeValidationContext) => boolean;
};

type NodeShapeBase = {
  contentClassName?: string;
};

export type NodeShape =
  | (NodeShapeBase & {
      /** border-radius による四角形ベースの描画 */
      kind: "rounded";
      /** CSS border-radius */
      borderRadius: string;
    })
  | (NodeShapeBase & {
      /** clip-path による多角形の描画 */
      kind: "clip";
      /** CSS clip-path */
      clipPath: string;
    });

export type NodeIcon =
  | { kind: "circle"; r: number }
  | { kind: "polygon"; points: string };

export type NodeTypeDef = {
  type: NodeType;
  label: string;
  description: string;
  color: string;
  icon: NodeIcon;
  shape: NodeShape;
  constraints?: NodeTypeConstraint[];
};

/** 入力(in)と出力(out)を同時には持てない制約 */
const singleDirectionConstraint: NodeTypeConstraint = {
  message: "入退出点は入力または出力のどちらか一方のみ可能です",
  validate: (ctx) => !(ctx.roles.has("in") && ctx.roles.has("out")),
};

export const NODE_TYPE_DEFS: NodeTypeDef[] = [
  {
    type: "GOAL",
    label: "目的地",
    description: "例: 展示ブース",
    color: "#0ea5e9",
    // 四角形（正方形）
    icon: { kind: "polygon", points: "12,12 88,12 88,88 12,88" },
    // 四角形
    shape: { kind: "rounded", borderRadius: "8px" },
  },
  {
    type: "GOAL_TRANSIT_MIXED",
    label: "目的地 / 通過",
    description: "例: 壁展示（目的地にも通過にもなりうる）",
    color: "#22c55e",
    // 円形
    icon: { kind: "circle", r: 44 },
    // 角丸が強い四角形
    shape: { kind: "rounded", borderRadius: "22px" },
  },
  {
    type: "TRANSIT_ONLY",
    label: "通過のみ",
    description: "例: 通路の分岐",
    color: "#a1a1aa",
    // ひし形
    icon: { kind: "polygon", points: "50,6 94,50 50,94 6,50" },
    // 四隅を切り落とした、ひし形に近い四角形（八角形）
    shape: {
      kind: "clip",
      clipPath:
        "polygon(25% 0, 75% 0, 100% 35%, 100% 65%, 75% 100%, 25% 100%, 0 65%, 0 35%)",
    },
  },
  {
    type: "BOUNDARY",
    label: "入退出点",
    description: "入力または出力のどちらか一方のみ",
    color: "#f59e0b",
    // 三角形（▷）
    icon: { kind: "polygon", points: "16,8 92,50 16,92" },
    // 横向きの三角形(▷)に近い台形
    shape: {
      kind: "clip",
      clipPath: "polygon(0 0, 100% 24%, 100% 76%, 0 100%)",
      contentClassName: "pr-3",
    },
    constraints: [singleDirectionConstraint],
  },
];

export const DEFAULT_NODE_TYPE: NodeType = "GOAL";

const DEFS_BY_TYPE = new Map(NODE_TYPE_DEFS.map((d) => [d.type, d]));

export function getNodeTypeDef(type: NodeType): NodeTypeDef {
  return DEFS_BY_TYPE.get(type) ?? NODE_TYPE_DEFS[0];
}

/**
 * 指定ノードが持つ通行向き集合を、エッジの方向を考慮して算出
 * - 片方向(oneway): 始点=out / 終点=in
 * - 両通行(both): 両端とも in かつ out
 */
export function nodeRoles(
  nodeId: string,
  edges: GraphEdgeType[],
): Set<NodeRole> {
  const roles = new Set<NodeRole>();
  for (const e of edges) {
    const bidirectional = (e.data?.direction ?? "both") === "both";
    if (e.source === nodeId) {
      roles.add("out");
      if (bidirectional) roles.add("in");
    }
    if (e.target === nodeId) {
      roles.add("in");
      if (bidirectional) roles.add("out");
    }
  }
  return roles;
}

export type ValidationResult = { ok: true } | { ok: false; message: string };

const VALID: ValidationResult = { ok: true };

/** タイプ `type` が、コンテキスト `ctx` の下で全制約を満たすか検証 */
export function validateNodeType(
  type: NodeType,
  ctx: NodeValidationContext,
): ValidationResult {
  const def = getNodeTypeDef(type);
  for (const constraint of def.constraints ?? []) {
    if (!constraint.validate(ctx)) {
      return { ok: false, message: constraint.message };
    }
  }
  return VALID;
}

function contextFor(
  nodeId: string,
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): NodeValidationContext {
  return { nodeId, roles: nodeRoles(nodeId, edges), nodes, edges };
}

/** 指定エッジ集合の下で、対象ノード群が各自の現タイプの制約を満たすか */
function validateEndpoints(
  nodeIds: Iterable<string>,
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): ValidationResult {
  for (const nodeId of new Set(nodeIds)) {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      const result = validateNodeType(
        node.data.nodeType,
        contextFor(nodeId, nodes, edges),
      );
      if (!result.ok) return result;
    }
  }
  return VALID;
}

/**
 * 与えられたエッジ集合の下で、ノードを `type` にしてよいか
 */
export function validateAssignType(
  type: NodeType,
  nodeId: string,
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): ValidationResult {
  return validateNodeType(type, contextFor(nodeId, nodes, edges));
}

/**
 * src→tgt を接続する際に使える通行方向を解決
 * 既定の "both" が制約に反する場合は "oneway" を試し、いずれも不可なら null
 */
export function resolveConnectionDirection(
  source: string,
  target: string,
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): EdgeDirection | null {
  const candidates: EdgeDirection[] = ["both", "oneway"];
  for (const direction of candidates) {
    const candidate = {
      id: "__candidate__",
      source,
      target,
      type: "graph",
      data: { direction },
    } as GraphEdgeType;
    if (validateEndpoints([source, target], nodes, [...edges, candidate]).ok) {
      return direction;
    }
  }
  return null;
}

/** エッジの通行方向を `direction` にしても、両端の現タイプ制約を満たすか */
export function validateEdgeDirection(
  edge: GraphEdgeType,
  direction: EdgeDirection,
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): ValidationResult {
  const next = edges.map((e) =>
    e.id === edge.id
      ? { ...e, data: { ...(e.data ?? { direction }), direction } }
      : e,
  );
  return validateEndpoints([edge.source, edge.target], nodes, next);
}

/** エッジの向きを反転しても、両端の現タイプ制約を満たすか */
export function validateReverseEdge(
  edge: GraphEdgeType,
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): ValidationResult {
  const reversed = edges.map((e) =>
    e.id === edge.id ? { ...e, source: e.target, target: e.source } : e,
  );
  return validateEndpoints([edge.source, edge.target], nodes, reversed);
}
