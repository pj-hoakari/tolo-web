import type { XYPosition } from "@xyflow/react";
import {
  type GraphCanvasNode,
  type GraphEdgeType,
  isGroupNode,
} from "../../type";
import { ORDERING_SWEEPS } from "./constants";
import { liftEdges, parentContainerOf, representativeIn } from "./graphIndex";
import type {
  Axis,
  ContainerId,
  ContainerPlan,
  Direction,
  GraphIndex,
  LiftedEdge,
  PlannedComponent,
} from "./types";

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

/**
 * 「同じ相手に接続される同じ層のメンバー」同士を繋ぐルート（兄弟ルート）の
 * 添字を返す。端点の 2 メンバーが「共通の流入元」と「共通の流出先」の両方を
 * （互いを除いて）持つ場合、層をまたぐ流れではなく同一層内の連絡とみなす。
 * （例: α→A→β と α→B→β があるときの A→B。α と β を共有している）
 */
function findSiblingEdgeIndexes(internal: LiftedEdge[]): Set<number> {
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    const set = map.get(key);
    if (set) set.add(value);
    else map.set(key, new Set([value]));
  };
  for (const { from, to } of internal) {
    add(outgoing, from, to);
    add(incoming, to, from);
  }
  const sharesOther = (
    a: Set<string> | undefined,
    b: Set<string> | undefined,
    exclude1: string,
    exclude2: string,
  ): boolean => {
    if (!a || !b) return false;
    for (const id of a) {
      if (id === exclude1 || id === exclude2) continue;
      if (b.has(id)) return true;
    }
    return false;
  };
  const result = new Set<number>();
  for (const [index, { from, to }] of internal.entries()) {
    if (
      sharesOther(incoming.get(from), incoming.get(to), from, to) &&
      sharesOther(outgoing.get(from), outgoing.get(to), from, to)
    ) {
      result.add(index);
    }
  }
  return result;
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

/**
 * フロー軸と向き: 現在の配置でルートがどちらへ流れているかを、
 * 両端の変位の合計で多数決する（ユーザーの配置の尊重）
 */
function detectFlowOrientation(
  flowEdges: LiftedEdge[],
  currentCenters: Map<string, XYPosition>,
): { axis: Axis; flip: boolean } {
  let horizontalSpan = 0;
  let verticalSpan = 0;
  let signedX = 0;
  let signedY = 0;
  for (const { from, to } of flowEdges) {
    const a = currentCenters.get(from);
    const b = currentCenters.get(to);
    if (!a || !b) continue;
    horizontalSpan += Math.abs(b.x - a.x);
    verticalSpan += Math.abs(b.y - a.y);
    signedX += b.x - a.x;
    signedY += b.y - a.y;
  }
  const axis: Axis = verticalSpan > horizontalSpan ? "y" : "x";
  return { axis, flip: (axis === "x" ? signedX : signedY) < 0 };
}

/**
 * 外へ出るルートを持つメンバーの行き先を決める:
 * 相手がフロー軸方向なら端の列（layerSide）へ、直交方向なら境界バンド
 * （crossBias）へ
 */
function classifyExternalPulls(
  container: ContainerId,
  external: Map<string, string[]>,
  axis: Axis,
  index: GraphIndex,
  plans: Map<ContainerId, ContainerPlan>,
): { layerSide: Map<string, number>; crossBias: Map<string, number> } {
  const layerSide = new Map<string, number>();
  const crossBias = new Map<string, number>();
  if (container === undefined) return { layerSide, crossBias };
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
  return { layerSide, crossBias };
}

/**
 * 接続相手（コンテナ外の相手を含む）の平均位置へ寄せる緩和計算。
 * ユーザーが同じ位置に重ねて置いたメンバーの順序決めにだけ使う補助値
 */
function relaxCrossPositions(
  memberIds: string[],
  internal: LiftedEdge[],
  external: Map<string, string[]>,
  crossOfCurrent: (id: string) => number,
): Map<string, number> {
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
  const relaxed = new Map(memberIds.map((id) => [id, crossOfCurrent(id)]));
  for (let sweep = 0; sweep < ORDERING_SWEEPS; sweep += 1) {
    for (const id of memberIds) {
      const values = [
        ...(neighborIds.get(id) ?? []).map((n) => relaxed.get(n) ?? 0),
        ...(anchorCrosses.get(id) ?? []),
      ];
      if (values.length > 0) {
        relaxed.set(id, values.reduce((sum, v) => sum + v, 0) / values.length);
      }
    }
  }
  return relaxed;
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
  // 同一層内の連絡とみなす兄弟ルートは、層の割り当てと
  // フロー方向の判定から除外する（同じ列に留める）
  const siblingEdges = findSiblingEdgeIndexes(internal);
  const flowEdges = internal.filter((_, i) => !siblingEdges.has(i));

  const { axis, flip } = detectFlowOrientation(flowEdges, currentCenters);
  const mainOfCurrent = (id: string): number => {
    const center = currentCenters.get(id);
    return center ? (axis === "x" ? center.x : center.y) : 0;
  };
  const crossOfCurrent = (id: string): number => {
    const center = currentCenters.get(id);
    return center ? (axis === "x" ? center.y : center.x) : 0;
  };

  const layerOf = assignLayers(memberIds, flowEdges);
  const { layerSide, crossBias } = classifyExternalPulls(
    container,
    external,
    axis,
    index,
    plans,
  );
  const relaxedCross = relaxCrossPositions(
    memberIds,
    internal,
    external,
    crossOfCurrent,
  );
  const seedCross = new Map(memberIds.map((id) => [id, crossOfCurrent(id)]));

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
  const buildComponent = (componentIds: string[]): PlannedComponent => {
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
    // 列内の並び順はユーザーの現在の並び（クロス軸位置）を最優先し、
    // 同じ位置に重なっているときだけ接続相手の平均位置で決める
    const sortedIds = [...columnMemberIds].sort(
      (a, b) =>
        (seedCross.get(a) ?? 0) - (seedCross.get(b) ?? 0) ||
        (relaxedCross.get(a) ?? 0) - (relaxedCross.get(b) ?? 0) ||
        (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
    );
    for (const id of sortedIds) {
      const rank = rankOf.get(effectiveLayer.get(id) ?? 0) ?? 0;
      columnOf.set(id, rank);
      orderOf.set(id, columns[rank].length);
      columns[rank].push(id);
    }
    return { columns, bandStart, bandEnd };
  };

  const built = connectedComponents(memberIds, internal).map(
    (componentIds) => ({
      component: buildComponent(componentIds),
      minSeedCross: Math.min(
        ...componentIds.map((id) => seedCross.get(id) ?? 0),
      ),
      minIndex: Math.min(...componentIds.map((id) => orderIndex.get(id) ?? 0)),
    }),
  );

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
export function planContainers(
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
