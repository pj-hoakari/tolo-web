import type {
  EdgeDirection,
  GraphEdgeType,
  GraphNodeType,
  GraphNotice,
  NodeType,
  NoticeLevel,
} from "./type";

export type NodeRole = "in" | "out";

/**
 * `Graph.notices` 配下のメッセージキーを表示用の文言に変換する関数。
 * 検証・通知はロケールを知らないので、描画側から渡してもらう。
 */
export type NoticeTranslator = (messageKey: string) => string;

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
  messageKey: string;
  validate: (ctx: NodeValidationContext) => boolean;
};

/**
 * 制約違反ではないが、利用者に強調して伝えたい状態を表す通知。
 * validation 機構（NodeTypeConstraint）と同じコンテキストで条件を評価する。
 */
export type NodeTypeNotice = {
  level: NoticeLevel;
  messageKey: string;
  /** この通知を出す条件 */
  match: (ctx: NodeValidationContext) => boolean;
};

export type NodeIcon =
  | { kind: "circle"; r: number }
  | { kind: "polygon"; points: string };

/**
 * ノードタイプの定義。表示名と説明は `Graph.nodeType` / `Graph.nodeTypeDescription`
 * の `type` をキーにしたメッセージで解決する。
 */
export type NodeTypeDef = {
  type: NodeType;
  color: string;
  icon: NodeIcon;
  constraints?: NodeTypeConstraint[];
  notices?: NodeTypeNotice[];
};

/** 入力(in)と出力(out)の両方を担っている入退出点を強調する通知 */
const dualDirectionNotice: NodeTypeNotice = {
  level: "info",
  messageKey: "dualDirection",
  match: (ctx) => ctx.roles.has("in") && ctx.roles.has("out"),
};

export const NODE_TYPE_DEFS: NodeTypeDef[] = [
  {
    type: "GOAL",
    color: "#0ea5e9",
    // 四角形（正方形）
    icon: { kind: "polygon", points: "12,12 88,12 88,88 12,88" },
  },
  {
    type: "GOAL_TRANSIT_MIXED",
    color: "#22c55e",
    // 円形
    icon: { kind: "circle", r: 44 },
  },
  {
    type: "TRANSIT_ONLY",
    color: "#a1a1aa",
    // ひし形
    icon: { kind: "polygon", points: "50,6 94,50 50,94 6,50" },
  },
  {
    type: "BOUNDARY",
    color: "#f59e0b",
    // 三角形（▷）
    icon: { kind: "polygon", points: "16,8 92,50 16,92" },
    notices: [dualDirectionNotice],
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

export type ValidationResult = { ok: true } | { ok: false; messageKey: string };

const VALID: ValidationResult = { ok: true };

/** タイプ `type` が、コンテキスト `ctx` の下で全制約を満たすか検証 */
export function validateNodeType(
  type: NodeType,
  ctx: NodeValidationContext,
): ValidationResult {
  const def = getNodeTypeDef(type);
  for (const constraint of def.constraints ?? []) {
    if (!constraint.validate(ctx)) {
      return { ok: false, messageKey: constraint.messageKey };
    }
  }
  return VALID;
}

/** タイプ `type` が、コンテキスト `ctx` の下で該当する通知を収集 */
export function collectNodeTypeNotices(
  type: NodeType,
  ctx: NodeValidationContext,
): GraphNotice[] {
  const def = getNodeTypeDef(type);
  const notices: GraphNotice[] = [];
  for (const notice of def.notices ?? []) {
    if (notice.match(ctx)) {
      notices.push({ level: notice.level, messageKey: notice.messageKey });
    }
  }
  return notices;
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

/** 指定ノードの現タイプ・接続状況で該当する通知を収集 */
export function collectNodeNotices(
  nodeId: string,
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): GraphNotice[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  return collectNodeTypeNotices(
    node.data.nodeType,
    contextFor(nodeId, nodes, edges),
  );
}

/**
 * 各ノードの現タイプ・接続状況から通知を算出し、描画用にノードデータへ注入
 * （handles と同様の派生情報。永続化時には除外される）
 */
export function deriveNodeNotices(
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): GraphNodeType[] {
  return nodes.map((n) => {
    const notices = collectNodeNotices(n.id, nodes, edges);
    if (notices.length === 0) return n;
    return { ...n, data: { ...n.data, notices } };
  });
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
