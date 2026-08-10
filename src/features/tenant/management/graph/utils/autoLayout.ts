import type { XYPosition } from "@xyflow/react";
import {
  type GraphCanvasNode,
  type GraphEdgeType,
  isGroupNode,
  isPointNode,
} from "../type";
import {
  absolutePositionOf,
  fitGroupsToChildren,
  GROUP_DEFAULT_HEIGHT,
  GROUP_DEFAULT_WIDTH,
  GROUP_FIT_PADDING_BOTTOM,
  GROUP_FIT_PADDING_TOP,
  GROUP_FIT_PADDING_X,
  GROUP_MIN_HEIGHT,
  GROUP_MIN_WIDTH,
  sizeOf,
} from "./groups";

/**
 * 自動整列。接続（ルート）に沿って流れる階層型レイアウトを、
 * グループのネスト構造に対して再帰的に適用する。
 *
 * - フローの軸と向きはユーザーの現在の配置から決める（ルート両端の変位の
 *   合計を軸ごとに比べる閾値判定）。縦に並べてあれば縦へ、右→左なら右→左へ。
 * - 計画パス（外側→内側）: コンテナ（キャンバス直下・各グループ）ごとに、
 *   直下メンバーへ持ち上げたルートから列（レイヤー）と列内順序を決める。
 *   グループをまたぐルートの端点は、相手がフロー軸方向なら端の列へ、
 *   フロー軸と直交する方向なら内部フローと重ならないよう、相手側に面した
 *   辺の「境界バンド」へ退避させる。
 * - 確定パス（内側→外側）: 内側のグループからサイズを確定し、列を配置する
 *   際に「またぐルートの両端ポイントの位置」ができるだけ揃うよう列全体を
 *   クロス軸方向へずらす。グループの位置もこのずらしで揃う。
 * - 絶対座標を親相対へ戻し、グループを子へフィットさせて確定する。
 */

/** 列（レイヤー）間の、フロー軸方向の間隔 */
const LAYER_GAP = 120;
/** 列内・境界バンド内のメンバー間隔 */
const MEMBER_GAP = 48;
/** 連結成分（ルートで繋がっていない塊）間の間隔 */
const COMPONENT_GAP = 96;
/** 列内順序を接続相手の平均位置へ寄せる緩和計算の反復回数 */
const ORDERING_SWEEPS = 3;

/** フロー軸。x = 左右へ流れる、y = 上下へ流れる */
type Axis = "x" | "y";
type ContainerId = string | undefined;
type Size = { width: number; height: number };

/** コンテナ外の相手ノードのおおまかな方角 */
type Direction = { axis: Axis; sign: number };

type GraphIndex = {
  byId: Map<string, GraphCanvasNode>;
  /** コンテナ（undefined = キャンバス直下）→ 直下メンバー */
  childrenOf: Map<ContainerId, GraphCanvasNode[]>;
};

/** コンテナ直下のメンバーへ持ち上げたルート */
type LiftedEdge = {
  /** source 側端点を含むメンバー */
  from: string;
  /** target 側端点を含むメンバー */
  to: string;
  /** 元のルートの端点（位置を揃える対象のポイント） */
  sourceId: string;
  targetId: string;
};

/** 連結成分ひとつ分の配置計画 */
type PlannedComponent = {
  /** フロー軸に沿った列 → クロス軸方向に上（左）から順のメンバー ID */
  columns: string[][];
  /** クロス軸の手前側（上／左）の境界バンドに置くメンバー ID（主軸順） */
  bandStart: string[];
  /** クロス軸の奥側（下／右）の境界バンドに置くメンバー ID（主軸順） */
  bandEnd: string[];
};

/** コンテナごとの整列計画 */
type ContainerPlan = {
  axis: Axis;
  components: PlannedComponent[];
  /** メンバー ID → 列番号（成分内で 0 始まり。バンド行きは含まない） */
  columnOf: Map<string, number>;
  /** メンバー ID → 列内の並び順 */
  orderOf: Map<string, number>;
  /** 境界バンド行きのメンバー ID → 側（-1: 手前 / 1: 奥） */
  bandOf: Map<string, number>;
  /** コンテナ内で完結するルート */
  internal: LiftedEdge[];
};

/** コンテナ内容の確定レイアウト（内容バウンディングボックスの左上が原点） */
type FinalizedContent = {
  size: Size;
  /** 直下メンバー ID → 中心座標 */
  memberCenters: Map<string, XYPosition>;
  /** 直下メンバー ID → 占有ボックスサイズ */
  memberSizes: Map<string, Size>;
  /** 配下すべてのポイント ID → 中心座標 */
  pointCenters: Map<string, XYPosition>;
};

function buildIndex(nodes: GraphCanvasNode[]): GraphIndex {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<ContainerId, GraphCanvasNode[]>();
  for (const node of nodes) {
    const key =
      node.parentId !== undefined && byId.has(node.parentId)
        ? node.parentId
        : undefined;
    const list = childrenOf.get(key);
    if (list) list.push(node);
    else childrenOf.set(key, [node]);
  }
  return { byId, childrenOf };
}

function parentContainerOf(nodeId: string, index: GraphIndex): ContainerId {
  const parentId = index.byId.get(nodeId)?.parentId;
  return parentId !== undefined && index.byId.has(parentId)
    ? parentId
    : undefined;
}

/**
 * ノードを、指定コンテナの直下メンバーであるノード（自身または祖先）へ
 * 持ち上げる。コンテナの外にあるノードは undefined。
 */
function representativeIn(
  container: ContainerId,
  nodeId: string,
  index: GraphIndex,
): string | undefined {
  let currentId: string | undefined = nodeId;
  const visited = new Set<string>();
  while (currentId !== undefined && !visited.has(currentId)) {
    visited.add(currentId);
    if (!index.byId.has(currentId)) return undefined;
    const parent = parentContainerOf(currentId, index);
    if (parent === container) return currentId;
    currentId = parent;
  }
  return undefined;
}

/** ルートをコンテナ直下メンバー間の隣接（内側）と外向きの参照（外側）に分ける */
function liftEdges(
  container: ContainerId,
  edges: GraphEdgeType[],
  index: GraphIndex,
): { internal: LiftedEdge[]; external: Map<string, string[]> } {
  const internal: LiftedEdge[] = [];
  const external = new Map<string, string[]>();
  const pushExternal = (member: string, outsideId: string) => {
    const list = external.get(member);
    if (list) list.push(outsideId);
    else external.set(member, [outsideId]);
  };
  for (const edge of edges) {
    const from = representativeIn(container, edge.source, index);
    const to = representativeIn(container, edge.target, index);
    if (from !== undefined && to !== undefined) {
      if (from !== to) {
        internal.push({
          from,
          to,
          sourceId: edge.source,
          targetId: edge.target,
        });
      }
      continue;
    }
    if (from !== undefined) pushExternal(from, edge.target);
    if (to !== undefined) pushExternal(to, edge.source);
  }
  return { internal, external };
}

/** 循環を無視した最長パスで各メンバーの列（レイヤー）番号を割り当てる */
function assignLayers(
  memberIds: string[],
  internal: LiftedEdge[],
): Map<string, number> {
  const outgoing = new Map<string, string[]>(memberIds.map((id) => [id, []]));
  const seenPairs = new Set<string>();
  for (const { from, to } of internal) {
    const key = `${from} ${to}`;
    if (seenPairs.has(key) || !outgoing.has(from) || !outgoing.has(to)) {
      continue;
    }
    seenPairs.add(key);
    outgoing.get(from)?.push(to);
  }

  // DFS で循環を作る逆流エッジを取り除く
  const acyclic = new Map<string, string[]>(memberIds.map((id) => [id, []]));
  const state = new Map<string, "visiting" | "done">();
  for (const rootId of memberIds) {
    if (state.has(rootId)) continue;
    const stack = [{ id: rootId, nextIndex: 0 }];
    state.set(rootId, "visiting");
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const targets = outgoing.get(frame.id) ?? [];
      if (frame.nextIndex < targets.length) {
        const next = targets[frame.nextIndex];
        frame.nextIndex += 1;
        if (state.get(next) === "visiting") continue;
        acyclic.get(frame.id)?.push(next);
        if (!state.has(next)) {
          state.set(next, "visiting");
          stack.push({ id: next, nextIndex: 0 });
        }
      } else {
        state.set(frame.id, "done");
        stack.pop();
      }
    }
  }

  // 入次数 0 のメンバーを起点に、最長パス長を列番号とする
  const indegree = new Map<string, number>(memberIds.map((id) => [id, 0]));
  for (const targets of acyclic.values()) {
    for (const target of targets) {
      indegree.set(target, (indegree.get(target) ?? 0) + 1);
    }
  }
  const layerOf = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const queue = memberIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    for (const target of acyclic.get(id) ?? []) {
      layerOf.set(
        target,
        Math.max(layerOf.get(target) ?? 0, (layerOf.get(id) ?? 0) + 1),
      );
      const rest = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, rest);
      if (rest === 0) queue.push(target);
    }
  }
  return layerOf;
}

/** 内側ルートの隣接で繋がった連結成分（元の配列順を保つ） */
function connectedComponents(
  memberIds: string[],
  internal: LiftedEdge[],
): string[][] {
  const neighbors = new Map<string, string[]>(memberIds.map((id) => [id, []]));
  for (const { from, to } of internal) {
    neighbors.get(from)?.push(to);
    neighbors.get(to)?.push(from);
  }
  const assigned = new Set<string>();
  const components: string[][] = [];
  for (const id of memberIds) {
    if (assigned.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    assigned.add(id);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      component.push(current);
      for (const next of neighbors.get(current) ?? []) {
        if (assigned.has(next)) continue;
        assigned.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }
  return components;
}

/**
 * グループから外へ出るルートについて、相手側が整列後にどの方角へ来るかを
 * 判定する。相手が同じ階層に現れるまで祖先コンテナを遡り、その階層の
 * 計画（列番号・列内順序・バンド所属）から軸と符号を割り出す。
 */
function externalDirection(
  containerId: string,
  outsideNodeId: string,
  index: GraphIndex,
  plans: Map<ContainerId, ContainerPlan>,
): Direction | undefined {
  let selfRep = containerId;
  let level = parentContainerOf(containerId, index);
  const visited = new Set<string>([containerId]);
  const levels: { selfRep: string; level: ContainerId }[] = [
    { selfRep, level },
  ];
  while (level !== undefined && !visited.has(level)) {
    visited.add(level);
    selfRep = level;
    level = parentContainerOf(level, index);
    levels.push({ selfRep, level });
  }
  for (const entry of levels) {
    const otherRep = representativeIn(entry.level, outsideNodeId, index);
    if (otherRep === undefined) continue;
    const plan = plans.get(entry.level);
    if (!plan) return undefined;
    const crossAxis: Axis = plan.axis === "x" ? "y" : "x";
    // バンド所属はクロス軸の端に居る（居ることになる）
    const selfBand = plan.bandOf.get(entry.selfRep) ?? 0;
    const otherBand = plan.bandOf.get(otherRep) ?? 0;
    if (otherBand !== selfBand) {
      return { axis: crossAxis, sign: Math.sign(otherBand - selfBand) };
    }
    const selfColumn = plan.columnOf.get(entry.selfRep);
    const otherColumn = plan.columnOf.get(otherRep);
    if (
      selfColumn !== undefined &&
      otherColumn !== undefined &&
      selfColumn !== otherColumn
    ) {
      return { axis: plan.axis, sign: Math.sign(otherColumn - selfColumn) };
    }
    const selfOrder = plan.orderOf.get(entry.selfRep);
    const otherOrder = plan.orderOf.get(otherRep);
    if (
      selfOrder !== undefined &&
      otherOrder !== undefined &&
      selfOrder !== otherOrder
    ) {
      return { axis: crossAxis, sign: Math.sign(otherOrder - selfOrder) };
    }
    return undefined;
  }
  return undefined;
}

/** コンテナ 1 つ分の整列計画（フロー軸・列の割り当て・列内順序）を立てる */
function planContainer(
  container: ContainerId,
  members: GraphCanvasNode[],
  index: GraphIndex,
  edges: GraphEdgeType[],
  currentCenters: Map<string, XYPosition>,
  plans: Map<ContainerId, ContainerPlan>,
): ContainerPlan {
  const memberIds = members.map((n) => n.id);
  const { internal, external } = liftEdges(container, edges, index);

  // フロー軸と向き: 現在の配置でルートがどちらへ流れているかを、
  // 両端の変位の合計で多数決する（ユーザーの配置の尊重）
  let horizontalSpan = 0;
  let verticalSpan = 0;
  let signedX = 0;
  let signedY = 0;
  for (const { from, to } of internal) {
    const a = currentCenters.get(from);
    const b = currentCenters.get(to);
    if (!a || !b) continue;
    horizontalSpan += Math.abs(b.x - a.x);
    verticalSpan += Math.abs(b.y - a.y);
    signedX += b.x - a.x;
    signedY += b.y - a.y;
  }
  const axis: Axis = verticalSpan > horizontalSpan ? "y" : "x";
  const flip = (axis === "x" ? signedX : signedY) < 0;

  const mainOfCurrent = (id: string): number => {
    const center = currentCenters.get(id);
    return center ? (axis === "x" ? center.x : center.y) : 0;
  };
  const crossOfCurrent = (id: string): number => {
    const center = currentCenters.get(id);
    return center ? (axis === "x" ? center.y : center.x) : 0;
  };

  const layerOf = assignLayers(memberIds, internal);

  // 外へ出るルートを持つメンバーの行き先:
  // 相手がフロー軸方向なら端の列へ、直交方向なら境界バンドへ
  const layerSide = new Map<string, number>();
  const crossBias = new Map<string, number>();
  if (container !== undefined) {
    for (const [member, outsideIds] of external) {
      let sumX = 0;
      let sumY = 0;
      for (const outsideId of outsideIds) {
        const direction = externalDirection(container, outsideId, index, plans);
        if (!direction) continue;
        if (direction.axis === "x") sumX += direction.sign;
        else sumY += direction.sign;
      }
      const mainSum = axis === "x" ? sumX : sumY;
      const crossSum = axis === "x" ? sumY : sumX;
      if (mainSum !== 0 && Math.abs(mainSum) >= Math.abs(crossSum)) {
        layerSide.set(member, Math.sign(mainSum));
      } else if (crossSum !== 0) {
        crossBias.set(member, Math.sign(crossSum));
      }
    }
  }

  // 列内順序: 現在のクロス軸位置を初期値に、接続相手（コンテナ外の相手を
  // 含む）の平均位置へ寄せる緩和計算で「近くへ繋がるものが近くに並ぶ」順を得る
  const neighborIds = new Map<string, string[]>(
    memberIds.map((id) => [id, []]),
  );
  for (const { from, to } of internal) {
    neighborIds.get(from)?.push(to);
    neighborIds.get(to)?.push(from);
  }
  const anchorCrosses = new Map<string, number[]>();
  for (const [member, outsideIds] of external) {
    anchorCrosses.set(
      member,
      outsideIds.map((id) => crossOfCurrent(id)),
    );
  }
  const seedCross = new Map(memberIds.map((id) => [id, crossOfCurrent(id)]));
  const relaxedCross = new Map(seedCross);
  for (let sweep = 0; sweep < ORDERING_SWEEPS; sweep += 1) {
    for (const id of memberIds) {
      const values = [
        ...(neighborIds.get(id) ?? []).map((n) => relaxedCross.get(n) ?? 0),
        ...(anchorCrosses.get(id) ?? []),
      ];
      if (values.length > 0) {
        relaxedCross.set(
          id,
          values.reduce((sum, v) => sum + v, 0) / values.length,
        );
      }
    }
  }

  // 連結成分ごとに列とバンドを確定する
  const orderIndex = new Map(memberIds.map((id, i) => [id, i]));
  const columnOf = new Map<string, number>();
  const orderOf = new Map<string, number>();
  const bandOf = new Map<string, number>();
  const sortBand = (ids: string[]): string[] =>
    [...ids].sort(
      (a, b) =>
        mainOfCurrent(a) - mainOfCurrent(b) ||
        (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
    );
  const built = connectedComponents(memberIds, internal).map((componentIds) => {
    const bandStart = sortBand(
      componentIds.filter((id) => (crossBias.get(id) ?? 0) < 0),
    );
    const bandEnd = sortBand(
      componentIds.filter((id) => (crossBias.get(id) ?? 0) > 0),
    );
    for (const id of bandStart) bandOf.set(id, -1);
    for (const id of bandEnd) bandOf.set(id, 1);
    const banded = new Set([...bandStart, ...bandEnd]);
    const columnMemberIds = componentIds.filter((id) => !banded.has(id));

    // ユーザーの向きが逆（右→左・下→上）なら列番号を反転して見た目に合わせる
    let maxLayer = 0;
    for (const id of columnMemberIds) {
      maxLayer = Math.max(maxLayer, layerOf.get(id) ?? 0);
    }
    const effectiveLayer = new Map<string, number>();
    for (const id of columnMemberIds) {
      const base = layerOf.get(id) ?? 0;
      const visual = flip ? maxLayer - base : base;
      const side = layerSide.get(id) ?? 0;
      effectiveLayer.set(id, side < 0 ? -1 : side > 0 ? maxLayer + 1 : visual);
    }
    const used = [...new Set(effectiveLayer.values())].sort((a, b) => a - b);
    const rankOf = new Map(used.map((value, i) => [value, i]));
    const columns: string[][] = used.map(() => []);
    const sortedIds = [...columnMemberIds].sort(
      (a, b) =>
        (relaxedCross.get(a) ?? 0) - (relaxedCross.get(b) ?? 0) ||
        (seedCross.get(a) ?? 0) - (seedCross.get(b) ?? 0) ||
        (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
    );
    for (const id of sortedIds) {
      const rank = rankOf.get(effectiveLayer.get(id) ?? 0) ?? 0;
      columnOf.set(id, rank);
      orderOf.set(id, columns[rank].length);
      columns[rank].push(id);
    }
    return {
      component: { columns, bandStart, bandEnd },
      minSeedCross: Math.min(
        ...componentIds.map((id) => seedCross.get(id) ?? 0),
      ),
      minIndex: Math.min(...componentIds.map((id) => orderIndex.get(id) ?? 0)),
    };
  });

  // 成分は整列前のおおまかなクロス軸位置順に手前から積む
  built.sort(
    (a, b) => a.minSeedCross - b.minSeedCross || a.minIndex - b.minIndex,
  );

  return {
    axis,
    components: built.map((entry) => entry.component),
    columnOf,
    orderOf,
    bandOf,
    internal,
  };
}

/** すべてのコンテナの整列計画を外側から順に立てる */
function planContainers(
  index: GraphIndex,
  edges: GraphEdgeType[],
  currentCenters: Map<string, XYPosition>,
): Map<ContainerId, ContainerPlan> {
  const plans = new Map<ContainerId, ContainerPlan>();
  const visit = (container: ContainerId) => {
    const members = index.childrenOf.get(container) ?? [];
    if (members.length === 0) return;
    plans.set(
      container,
      planContainer(container, members, index, edges, currentCenters, plans),
    );
    for (const member of members) {
      if (isGroupNode(member)) visit(member.id);
    }
  };
  visit(undefined);
  return plans;
}

/** メンバーが占有するボックスサイズ（グループは fitGroup と同じ規則で内容＋余白） */
function boxSizeOf(
  member: GraphCanvasNode,
  finalizedGroups: Map<string, FinalizedContent>,
): Size {
  if (isPointNode(member)) return sizeOf(member);
  const finalized = finalizedGroups.get(member.id);
  if (!finalized || finalized.memberCenters.size === 0) {
    return {
      width: Math.max(member.data.minWidth ?? 0, GROUP_DEFAULT_WIDTH),
      height: Math.max(member.data.minHeight ?? 0, GROUP_DEFAULT_HEIGHT),
    };
  }
  return {
    width: Math.max(
      finalized.size.width + GROUP_FIT_PADDING_X * 2,
      member.data.minWidth ?? 0,
      GROUP_MIN_WIDTH,
    ),
    height: Math.max(
      finalized.size.height + GROUP_FIT_PADDING_TOP + GROUP_FIT_PADDING_BOTTOM,
      member.data.minHeight ?? 0,
      GROUP_MIN_HEIGHT,
    ),
  };
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * 1 次元の並びを、並び順と最小間隔を保ったまま各メンバーの希望位置へ
 * できるだけ近づけて配置する。重なるメンバーは塊として希望位置の平均へ
 * まとめるため、共通の接続先を希望するメンバーはその中心を挟んで
 * 対称に並ぶ。
 */
function placeLine(
  ids: string[],
  sizeOfId: (id: string) => number,
  desiredOf: (id: string) => number,
  gap: number,
): Map<string, number> {
  type Cluster = { ids: string[]; offsets: number[]; base: number };
  const separation = (a: string, b: string) =>
    (sizeOfId(a) + sizeOfId(b)) / 2 + gap;
  const optimalBase = (cluster: Pick<Cluster, "ids" | "offsets">): number =>
    average(cluster.ids.map((id, i) => desiredOf(id) - cluster.offsets[i]));

  const clusters: Cluster[] = [];
  for (const id of ids) {
    let cluster: Cluster = { ids: [id], offsets: [0], base: desiredOf(id) };
    while (clusters.length > 0) {
      const prev = clusters[clusters.length - 1];
      const prevLastId = prev.ids[prev.ids.length - 1];
      const prevLastCenter = prev.base + prev.offsets[prev.offsets.length - 1];
      if (
        cluster.base >=
        prevLastCenter + separation(prevLastId, cluster.ids[0])
      ) {
        break;
      }
      // 前の塊と重なるので統合し、希望位置の平均へ置き直してさらに遡って確認
      clusters.pop();
      const shift =
        prev.offsets[prev.offsets.length - 1] +
        separation(prevLastId, cluster.ids[0]);
      const merged = {
        ids: [...prev.ids, ...cluster.ids],
        offsets: [...prev.offsets, ...cluster.offsets.map((o) => o + shift)],
      };
      cluster = { ...merged, base: optimalBase(merged) };
    }
    clusters.push(cluster);
  }

  const result = new Map<string, number>();
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.ids.length; i += 1) {
      result.set(cluster.ids[i], cluster.base + cluster.offsets[i]);
    }
  }
  return result;
}

/**
 * コンテナ内容のレイアウトを内側から順に確定する。
 * 列はフロー軸に沿って送り、列内の各メンバーは「配置済みの接続相手
 * （共通ノード）の端点位置」を希望位置としてクロス軸方向に揃える。
 * 境界バンドは内容の外側（相手側に面した辺）で、同じく接続相手の
 * 主軸位置を基準に並べる。
 */
function finalizeContainer(
  container: ContainerId,
  index: GraphIndex,
  plans: Map<ContainerId, ContainerPlan>,
  finalizedGroups: Map<string, FinalizedContent>,
): FinalizedContent {
  const members = index.childrenOf.get(container) ?? [];
  for (const member of members) {
    if (isGroupNode(member)) {
      finalizedGroups.set(
        member.id,
        finalizeContainer(member.id, index, plans, finalizedGroups),
      );
    }
  }

  const memberCenters = new Map<string, XYPosition>();
  const memberSizes = new Map<string, Size>();
  const pointCenters = new Map<string, XYPosition>();
  const plan = plans.get(container);
  if (!plan || members.length === 0) {
    return {
      size: { width: 0, height: 0 },
      memberCenters,
      memberSizes,
      pointCenters,
    };
  }
  const { axis } = plan;

  for (const member of members) {
    memberSizes.set(member.id, boxSizeOf(member, finalizedGroups));
  }
  const mainSizeOf = (id: string): number => {
    const size = memberSizes.get(id);
    return size ? (axis === "x" ? size.width : size.height) : 0;
  };
  const crossSizeOf = (id: string): number => {
    const size = memberSizes.get(id);
    return size ? (axis === "x" ? size.height : size.width) : 0;
  };
  const toPoint = (main: number, cross: number): XYPosition =>
    axis === "x" ? { x: main, y: cross } : { x: cross, y: main };

  /** 確定済みメンバー内にあるルート端点の、メンバー中心からのクロス軸オフセット */
  const endpointOffsetCross = (
    memberId: string,
    endpointId: string,
  ): number => {
    if (memberId === endpointId) return 0;
    const finalized = finalizedGroups.get(memberId);
    const size = memberSizes.get(memberId);
    const local = finalized?.pointCenters.get(endpointId);
    if (!size || local === undefined) return 0;
    return axis === "x"
      ? GROUP_FIT_PADDING_TOP + local.y - size.height / 2
      : GROUP_FIT_PADDING_X + local.x - size.width / 2;
  };

  /** 確定済みメンバー内にあるルート端点の、メンバー中心からの主軸オフセット */
  const endpointOffsetMain = (memberId: string, endpointId: string): number => {
    if (memberId === endpointId) return 0;
    const finalized = finalizedGroups.get(memberId);
    const size = memberSizes.get(memberId);
    const local = finalized?.pointCenters.get(endpointId);
    if (!size || local === undefined) return 0;
    return axis === "x"
      ? GROUP_FIT_PADDING_X + local.x - size.width / 2
      : GROUP_FIT_PADDING_TOP + local.y - size.height / 2;
  };

  // 成分ごとに列とバンドを配置し、成分はクロス軸方向へ積む
  let componentCrossTop = 0;
  let contentMainMax = 0;
  for (const { columns, bandStart, bandEnd } of plan.components) {
    /** 成分ローカルの {main, cross} 中心 */
    const placed = new Map<string, { main: number; cross: number }>();

    let columnStart = 0;
    for (const column of columns) {
      const columnMain = Math.max(...column.map((id) => mainSizeOf(id)));
      const centerMain = columnStart + columnMain / 2;

      // まず手前から順に詰む
      let stackCross = 0;
      const stacked = new Map<string, number>();
      for (const id of column) {
        const crossSize = crossSizeOf(id);
        stacked.set(id, stackCross + crossSize / 2);
        stackCross += crossSize + MEMBER_GAP;
      }

      // 各メンバーの希望位置 = 配置済みの接続相手（共通ノード）の端点位置。
      // 複数の相手がいればその中央値へ寄せる
      const desiredValues = new Map<string, number[]>();
      const columnSet = new Set(column);
      for (const { from, to, sourceId, targetId } of plan.internal) {
        const orientations: [string, string, string, string][] = [
          [from, sourceId, to, targetId],
          [to, targetId, from, sourceId],
        ];
        for (const [
          movingMember,
          movingPoint,
          placedMember,
          placedPoint,
        ] of orientations) {
          if (!columnSet.has(movingMember)) continue;
          const placedCenter = placed.get(placedMember);
          if (!placedCenter) continue;
          const targetCross =
            placedCenter.cross +
            endpointOffsetCross(placedMember, placedPoint) -
            endpointOffsetCross(movingMember, movingPoint);
          const list = desiredValues.get(movingMember);
          if (list) list.push(targetCross);
          else desiredValues.set(movingMember, [targetCross]);
        }
      }
      const desired = new Map<string, number>();
      for (const [id, values] of desiredValues) desired.set(id, median(values));

      let centers: Map<string, number>;
      if (desired.size === 0) {
        // 揃える相手がいない列は、詰んだ形のまま配置済みのクロス軸中心へ合わせる
        let shift = 0;
        if (placed.size > 0) {
          const placedCrosses = [...placed.values()].map((p) => p.cross);
          shift = average(placedCrosses) - average([...stacked.values()]);
        }
        centers = new Map(
          column.map((id) => [id, (stacked.get(id) ?? 0) + shift]),
        );
      } else {
        // 揃える相手がいないメンバーは、いるメンバーと同じ量だけずらした位置を希望する
        const shifts = column
          .filter((id) => desired.has(id))
          .map((id) => (desired.get(id) ?? 0) - (stacked.get(id) ?? 0));
        const defaultShift = median(shifts);
        centers = placeLine(
          column,
          crossSizeOf,
          (id) => desired.get(id) ?? (stacked.get(id) ?? 0) + defaultShift,
          MEMBER_GAP,
        );
      }

      for (const id of column) {
        placed.set(id, { main: centerMain, cross: centers.get(id) ?? 0 });
      }
      columnStart += columnMain + LAYER_GAP;
    }

    // 列に置いた内容の広がり（バンドの位置決めに使う）
    let contentMainMin = Number.POSITIVE_INFINITY;
    let contentMainMaxLocal = Number.NEGATIVE_INFINITY;
    let contentCrossMin = Number.POSITIVE_INFINITY;
    let contentCrossMax = Number.NEGATIVE_INFINITY;
    for (const [id, center] of placed) {
      contentMainMin = Math.min(
        contentMainMin,
        center.main - mainSizeOf(id) / 2,
      );
      contentMainMaxLocal = Math.max(
        contentMainMaxLocal,
        center.main + mainSizeOf(id) / 2,
      );
      contentCrossMin = Math.min(
        contentCrossMin,
        center.cross - crossSizeOf(id) / 2,
      );
      contentCrossMax = Math.max(
        contentCrossMax,
        center.cross + crossSizeOf(id) / 2,
      );
    }
    const hasColumns = placed.size > 0;
    if (!hasColumns) {
      contentMainMin = 0;
      contentMainMaxLocal = 0;
      contentCrossMin = 0;
      contentCrossMax = 0;
    }

    // 境界バンド: 内容の外側（相手側に面した辺）に主軸方向へ並べる。
    // 各メンバーは接続相手（共通ノード）の主軸位置を希望し、同じ相手を
    // 希望するメンバーはその中心を挟んで対称に置かれる
    const placeBand = (ids: string[], side: -1 | 1) => {
      if (ids.length === 0) return;
      const bandSet = new Set(ids);
      const desiredValues = new Map<string, number[]>();
      for (const { from, to, sourceId, targetId } of plan.internal) {
        const orientations: [string, string, string, string][] = [
          [from, sourceId, to, targetId],
          [to, targetId, from, sourceId],
        ];
        for (const [
          movingMember,
          movingPoint,
          placedMember,
          placedPoint,
        ] of orientations) {
          if (!bandSet.has(movingMember)) continue;
          const placedCenter = placed.get(placedMember);
          if (!placedCenter) continue;
          const targetMain =
            placedCenter.main +
            endpointOffsetMain(placedMember, placedPoint) -
            endpointOffsetMain(movingMember, movingPoint);
          const list = desiredValues.get(movingMember);
          if (list) list.push(targetMain);
          else desiredValues.set(movingMember, [targetMain]);
        }
      }
      const fallbackMain = (contentMainMin + contentMainMaxLocal) / 2;
      const centers = placeLine(
        ids,
        mainSizeOf,
        (id) => {
          const values = desiredValues.get(id);
          return values ? median(values) : fallbackMain;
        },
        MEMBER_GAP,
      );
      for (const id of ids) {
        const centerCross =
          side < 0
            ? contentCrossMin - MEMBER_GAP - crossSizeOf(id) / 2
            : contentCrossMax + MEMBER_GAP + crossSizeOf(id) / 2;
        placed.set(id, {
          main: centers.get(id) ?? fallbackMain,
          cross: centerCross,
        });
      }
    };
    placeBand(bandStart, -1);
    placeBand(bandEnd, 1);

    // 成分のバウンディングボックスを (0, componentCrossTop) 起点へ正規化する
    let minMain = Number.POSITIVE_INFINITY;
    let minCross = Number.POSITIVE_INFINITY;
    let maxMain = Number.NEGATIVE_INFINITY;
    let maxCross = Number.NEGATIVE_INFINITY;
    for (const [id, center] of placed) {
      minMain = Math.min(minMain, center.main - mainSizeOf(id) / 2);
      maxMain = Math.max(maxMain, center.main + mainSizeOf(id) / 2);
      minCross = Math.min(minCross, center.cross - crossSizeOf(id) / 2);
      maxCross = Math.max(maxCross, center.cross + crossSizeOf(id) / 2);
    }
    for (const [id, center] of placed) {
      memberCenters.set(
        id,
        toPoint(
          center.main - minMain,
          center.cross - minCross + componentCrossTop,
        ),
      );
    }
    contentMainMax = Math.max(contentMainMax, maxMain - minMain);
    componentCrossTop += maxCross - minCross + COMPONENT_GAP;
  }
  const contentCrossTotal = Math.max(0, componentCrossTop - COMPONENT_GAP);
  const size: Size =
    axis === "x"
      ? { width: contentMainMax, height: contentCrossTotal }
      : { width: contentCrossTotal, height: contentMainMax };

  // 配下すべてのポイント中心を、このコンテナ内容のローカル座標で集める
  for (const member of members) {
    const center = memberCenters.get(member.id);
    const memberSize = memberSizes.get(member.id);
    if (!center || !memberSize) continue;
    if (isPointNode(member)) {
      pointCenters.set(member.id, center);
      continue;
    }
    const finalized = finalizedGroups.get(member.id);
    if (!finalized) continue;
    const originX = center.x - memberSize.width / 2 + GROUP_FIT_PADDING_X;
    const originY = center.y - memberSize.height / 2 + GROUP_FIT_PADDING_TOP;
    for (const [pointId, local] of finalized.pointCenters) {
      pointCenters.set(pointId, {
        x: originX + local.x,
        y: originY + local.y,
      });
    }
  }

  return { size, memberCenters, memberSizes, pointCenters };
}

/**
 * グラフ全体を接続状況に基づいて自動整列した新しいノード配列を返す。
 * ポイントの position は中心・グループは左上・子は親相対という
 * 既存の座標系の約束を保ったまま位置だけを置き換える。
 */
export function autoAlignGraph(
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
): GraphCanvasNode[] {
  if (nodes.length === 0) return nodes;
  const index = buildIndex(nodes);

  // 現在の絶対中心（フロー軸の判定・並び順の初期値・全体位置の保持に使う）
  const currentCenters = new Map<string, XYPosition>();
  for (const node of nodes) {
    const abs = absolutePositionOf(node, index.byId);
    const size = sizeOf(node);
    currentCenters.set(
      node.id,
      isPointNode(node)
        ? abs
        : { x: abs.x + size.width / 2, y: abs.y + size.height / 2 },
    );
  }

  const plans = planContainers(index, edges, currentCenters);
  const finalizedGroups = new Map<string, FinalizedContent>();
  const root = finalizeContainer(undefined, index, plans, finalizedGroups);

  // 全体の左上を整列前のバウンディングボックスに合わせ、画面の大移動を避ける
  let originX = Number.POSITIVE_INFINITY;
  let originY = Number.POSITIVE_INFINITY;
  for (const member of index.childrenOf.get(undefined) ?? []) {
    const center = currentCenters.get(member.id);
    if (!center) continue;
    const size = sizeOf(member);
    originX = Math.min(originX, center.x - size.width / 2);
    originY = Math.min(originY, center.y - size.height / 2);
  }
  if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
    originX = 0;
    originY = 0;
  }

  // 絶対座標を計算する（ポイント = 中心、グループ = 左上）
  const absCenter = new Map<string, XYPosition>();
  const absTopLeft = new Map<string, XYPosition>();
  const boxSize = new Map<string, Size>();
  const place = (
    container: ContainerId,
    origin: XYPosition,
    content: FinalizedContent,
  ) => {
    for (const member of index.childrenOf.get(container) ?? []) {
      const center = content.memberCenters.get(member.id);
      const size = content.memberSizes.get(member.id);
      if (!center || !size) continue;
      const absoluteCenter = {
        x: origin.x + center.x,
        y: origin.y + center.y,
      };
      absCenter.set(member.id, absoluteCenter);
      const topLeft = {
        x: absoluteCenter.x - size.width / 2,
        y: absoluteCenter.y - size.height / 2,
      };
      absTopLeft.set(member.id, topLeft);
      boxSize.set(member.id, size);
      if (isGroupNode(member)) {
        const finalized = finalizedGroups.get(member.id);
        if (finalized) {
          place(
            member.id,
            {
              x: topLeft.x + GROUP_FIT_PADDING_X,
              y: topLeft.y + GROUP_FIT_PADDING_TOP,
            },
            finalized,
          );
        }
      }
    }
  };
  place(undefined, { x: originX, y: originY }, root);

  // 親相対へ戻して書き込む
  const aligned = nodes.map((node): GraphCanvasNode => {
    const parentTopLeft =
      node.parentId !== undefined ? absTopLeft.get(node.parentId) : undefined;
    const base = parentTopLeft ?? { x: 0, y: 0 };
    if (isPointNode(node)) {
      const center = absCenter.get(node.id);
      if (!center) return node;
      return {
        ...node,
        position: { x: center.x - base.x, y: center.y - base.y },
      };
    }
    const topLeft = absTopLeft.get(node.id);
    const size = boxSize.get(node.id);
    if (!topLeft || !size) return node;
    return {
      ...node,
      position: { x: topLeft.x - base.x, y: topLeft.y - base.y },
      width: size.width,
      height: size.height,
    };
  });

  // グループ矩形を通常の編集操作と同じ規則で最終確定させる
  return fitGroupsToChildren(aligned);
}
