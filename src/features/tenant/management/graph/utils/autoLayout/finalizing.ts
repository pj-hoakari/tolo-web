import type { XYPosition } from "@xyflow/react";
import { type GraphCanvasNode, isGroupNode, isPointNode } from "../../type";
import {
  GROUP_DEFAULT_HEIGHT,
  GROUP_DEFAULT_WIDTH,
  GROUP_FIT_PADDING_BOTTOM,
  GROUP_FIT_PADDING_TOP,
  GROUP_FIT_PADDING_X,
  GROUP_MIN_HEIGHT,
  GROUP_MIN_WIDTH,
  sizeOf,
} from "../groups";
import {
  COMPONENT_GAP,
  CROSS_GAP,
  LAYER_GAP,
  MEMBER_GAP,
  ROUTE_CLEARANCE,
} from "./constants";
import { average, median, placeLine } from "./math";
import type {
  Axis,
  ContainerId,
  ContainerPlan,
  FinalizedContent,
  GraphIndex,
  PlannedComponent,
  Size,
} from "./types";

/** 成分ローカルの座標（main = フロー軸方向、cross = 直交方向） */
type MainCross = { main: number; cross: number };

/**
 * 軸に依存する座標・サイズ計算をまとめたヘルパ。
 * フロー軸が縦横どちらでも、以降の配置処理を同じ式で書けるようにする
 */
type AxisGeometry = {
  axis: Axis;
  mainSizeOf: (id: string) => number;
  crossSizeOf: (id: string) => number;
  toPoint: (main: number, cross: number) => XYPosition;
  /** 整列前の現在位置のクロス軸成分 */
  crossOfCurrent: (id: string) => number;
  /** 確定済みメンバー内にあるルート端点の、メンバー中心からの主軸オフセット */
  endpointOffsetMain: (memberId: string, endpointId: string) => number;
  /** 同じくクロス軸オフセット */
  endpointOffsetCross: (memberId: string, endpointId: string) => number;
};

function createAxisGeometry(
  axis: Axis,
  memberSizes: Map<string, Size>,
  finalizedGroups: Map<string, FinalizedContent>,
  currentCenters: Map<string, XYPosition>,
): AxisGeometry {
  const sizeAlong = (id: string, along: Axis): number => {
    const size = memberSizes.get(id);
    return size ? (along === "x" ? size.width : size.height) : 0;
  };
  // グループの内容は左上から (PADDING_X, PADDING_TOP) の位置に置かれる
  // （fitGroup と同じ規則）ため、端点の中心オフセットもそこから計算する
  const endpointOffsetAlong = (
    memberId: string,
    endpointId: string,
    along: Axis,
  ): number => {
    if (memberId === endpointId) return 0;
    const finalized = finalizedGroups.get(memberId);
    const size = memberSizes.get(memberId);
    const local = finalized?.pointCenters.get(endpointId);
    if (!size || local === undefined) return 0;
    return along === "x"
      ? GROUP_FIT_PADDING_X + local.x - size.width / 2
      : GROUP_FIT_PADDING_TOP + local.y - size.height / 2;
  };
  const crossAxis: Axis = axis === "x" ? "y" : "x";
  return {
    axis,
    mainSizeOf: (id) => sizeAlong(id, axis),
    crossSizeOf: (id) => sizeAlong(id, crossAxis),
    toPoint: (main, cross) =>
      axis === "x" ? { x: main, y: cross } : { x: cross, y: main },
    crossOfCurrent: (id) => {
      const center = currentCenters.get(id);
      return center ? (axis === "x" ? center.y : center.x) : 0;
    },
    endpointOffsetMain: (memberId, endpointId) =>
      endpointOffsetAlong(memberId, endpointId, axis),
    endpointOffsetCross: (memberId, endpointId) =>
      endpointOffsetAlong(memberId, endpointId, crossAxis),
  };
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

/**
 * 列を飛び越すルート（両端の列が隣接しない）が通る「レーン」。
 * 中間の各列に確保する空きスペースで、飛び越される側のノードを
 * クロス軸方向へ押しのけてルートの通り道を空ける
 */
type Lane = {
  key: string;
  /** ひとつ手前の列の同じルートのレーン（連鎖して直線状に揃える） */
  prevKey?: string;
  /** 手前側の端点（レーンの揃え先） */
  startMember: string;
  startPoint: string;
  /** 挿し込み位置の手掛かり: 両端点の現在位置の中間 */
  seed: number;
};

type LanePlan = {
  lanesByColumn: Map<number, Lane[]>;
  /** 飛び越すルートの添字 → 終端メンバーと、その直前のレーン */
  longEdgeByIndex: Map<number, { endMember: string; lastKey: string }>;
};

/** 成分内の飛び越すルートを洗い出し、中間の列ごとにレーンを割り当てる */
function planLanes(
  component: PlannedComponent,
  plan: ContainerPlan,
  geometry: AxisGeometry,
): LanePlan {
  const columnMemberSet = new Set(component.columns.flat());
  const lanesByColumn = new Map<number, Lane[]>();
  const longEdgeByIndex = new Map<
    number,
    { endMember: string; lastKey: string }
  >();
  for (const [edgeIndex, edge] of plan.internal.entries()) {
    const columnFrom = plan.columnOf.get(edge.from);
    const columnTo = plan.columnOf.get(edge.to);
    if (columnFrom === undefined || columnTo === undefined) continue;
    if (!columnMemberSet.has(edge.from) || !columnMemberSet.has(edge.to)) {
      continue;
    }
    if (Math.abs(columnTo - columnFrom) < 2) continue;
    const ascending = columnFrom < columnTo;
    const low = Math.min(columnFrom, columnTo);
    const high = Math.max(columnFrom, columnTo);
    const seed =
      (geometry.crossOfCurrent(edge.sourceId) +
        geometry.crossOfCurrent(edge.targetId)) /
      2;
    let prevKey: string | undefined;
    let lastKey = "";
    for (let column = low + 1; column < high; column += 1) {
      lastKey = ` lane:${edgeIndex}:${column}`;
      const lane: Lane = {
        key: lastKey,
        prevKey,
        startMember: ascending ? edge.from : edge.to,
        startPoint: ascending ? edge.sourceId : edge.targetId,
        seed,
      };
      const list = lanesByColumn.get(column);
      if (list) list.push(lane);
      else lanesByColumn.set(column, [lane]);
      prevKey = lastKey;
    }
    longEdgeByIndex.set(edgeIndex, {
      endMember: ascending ? edge.to : edge.from,
      lastKey,
    });
  }
  return { lanesByColumn, longEdgeByIndex };
}

/**
 * 同じ列の中で他のメンバーを飛び越えて繋がるルート（兄弟ルート）のための
 * 主軸オフセットを求める。飛び越されるメンバーと遠い側の端点を左右へ離して
 * 通り道を空ける。隣どうしを繋ぐだけのルートはずらさない
 */
function intraColumnMainOffsets(
  column: string[],
  plan: ContainerPlan,
  geometry: AxisGeometry,
): (id: string) => number {
  const stackIndexOf = new Map(column.map((id, i) => [id, i]));
  const skippedMembers = new Set<string>();
  const farEndpoints = new Set<string>();
  let offset = 0;
  for (const { from, to } of plan.internal) {
    const fromIndex = stackIndexOf.get(from);
    const toIndex = stackIndexOf.get(to);
    if (fromIndex === undefined || toIndex === undefined) continue;
    if (Math.abs(toIndex - fromIndex) < 2) continue;
    const low = Math.min(fromIndex, toIndex);
    const high = Math.max(fromIndex, toIndex);
    let widestSkipped = 0;
    for (let i = low + 1; i < high; i += 1) {
      skippedMembers.add(column[i]);
      widestSkipped = Math.max(widestSkipped, geometry.mainSizeOf(column[i]));
    }
    farEndpoints.add(column[high]);
    // ルートの線（端点間の直線）が、飛び越されるメンバーの箱から
    // 通常より広めの余白をとって離れるだけのずらし量を確保する
    const span = high - low;
    const required =
      ((widestSkipped / 2 + ROUTE_CLEARANCE) * span) / (span + 1);
    offset = Math.max(offset, required);
  }
  offset = Math.min(offset, LAYER_GAP - MEMBER_GAP / 2);
  return (id: string): number => {
    if (skippedMembers.has(id)) return -offset;
    if (farEndpoints.has(id)) return offset;
    return 0;
  };
}

/**
 * 列 1 本分を配置する。メンバーの中心を placed へ、レーンの位置を
 * laneCrosses へ書き込み、次の列の開始位置を返す。
 * 列内の各メンバーは「配置済みの接続相手（共通ノード）の端点位置」を
 * 希望位置としてクロス軸方向に揃える
 */
function placeColumn(args: {
  column: string[];
  columnIndex: number;
  columnStart: number;
  plan: ContainerPlan;
  geometry: AxisGeometry;
  lanePlan: LanePlan;
  placed: Map<string, MainCross>;
  laneCrosses: Map<string, number>;
}): number {
  const {
    column,
    columnIndex,
    columnStart,
    plan,
    geometry,
    lanePlan,
    placed,
    laneCrosses,
  } = args;
  const columnMain = Math.max(...column.map((id) => geometry.mainSizeOf(id)));
  const centerMain = columnStart + columnMain / 2;

  // 実メンバーの並びは保ったまま、レーンを現在位置の近い位置へ挿し込む
  const lanes = [...(lanePlan.lanesByColumn.get(columnIndex) ?? [])].sort(
    (a, b) => a.seed - b.seed || (a.key < b.key ? -1 : 1),
  );
  const laneByKey = new Map(lanes.map((lane) => [lane.key, lane]));
  const entryIds: string[] = [];
  let laneCursor = 0;
  for (const id of column) {
    const memberSeed = geometry.crossOfCurrent(id);
    while (laneCursor < lanes.length && lanes[laneCursor].seed < memberSeed) {
      entryIds.push(lanes[laneCursor].key);
      laneCursor += 1;
    }
    entryIds.push(id);
  }
  for (; laneCursor < lanes.length; laneCursor += 1) {
    entryIds.push(lanes[laneCursor].key);
  }
  // レーンには占有幅を持たせ、ルートを挟むノード同士の間隔を
  // 通常より広めにとる
  const entryCrossSize = (id: string): number =>
    laneByKey.has(id) ? ROUTE_CLEARANCE : geometry.crossSizeOf(id);

  // まず手前から順に詰む
  let stackCross = 0;
  const stacked = new Map<string, number>();
  for (const id of entryIds) {
    const crossSize = entryCrossSize(id);
    stacked.set(id, stackCross + crossSize / 2);
    stackCross += crossSize + CROSS_GAP;
  }

  // 各メンバーの希望位置 = 配置済みの接続相手（共通ノード）の端点位置。
  // 複数の相手がいればその中央値へ寄せる。
  // 飛び越すルートの終端は、直接相手ではなく隣の列のレーンへ揃える
  const desiredValues = new Map<string, number[]>();
  const laneDesiredValues = new Map<string, number[]>();
  const pushValue = (map: Map<string, number[]>, id: string, value: number) => {
    const list = map.get(id);
    if (list) list.push(value);
    else map.set(id, [value]);
  };
  const columnSet = new Set(column);
  for (const [
    edgeIndex,
    { from, to, sourceId, targetId },
  ] of plan.internal.entries()) {
    const longEdge = lanePlan.longEdgeByIndex.get(edgeIndex);
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
      if (longEdge) {
        if (movingMember !== longEdge.endMember) continue;
        const laneCross = laneCrosses.get(longEdge.lastKey);
        if (laneCross === undefined) continue;
        pushValue(
          laneDesiredValues,
          movingMember,
          laneCross - geometry.endpointOffsetCross(movingMember, movingPoint),
        );
        continue;
      }
      const placedCenter = placed.get(placedMember);
      if (!placedCenter) continue;
      const targetCross =
        placedCenter.cross +
        geometry.endpointOffsetCross(placedMember, placedPoint) -
        geometry.endpointOffsetCross(movingMember, movingPoint);
      pushValue(desiredValues, movingMember, targetCross);
    }
  }
  const desired = new Map<string, number>();
  for (const [id, values] of desiredValues) desired.set(id, median(values));
  // 飛び越すルートを直線に保つため、レーンへの揃えを優先する
  for (const [id, values] of laneDesiredValues) {
    desired.set(id, median(values));
  }
  for (const lane of lanes) {
    const target =
      lane.prevKey !== undefined
        ? laneCrosses.get(lane.prevKey)
        : (() => {
            const placedCenter = placed.get(lane.startMember);
            if (!placedCenter) return undefined;
            return (
              placedCenter.cross +
              geometry.endpointOffsetCross(lane.startMember, lane.startPoint)
            );
          })();
    if (target !== undefined) desired.set(lane.key, target);
  }

  let centers: Map<string, number>;
  if (desired.size === 0) {
    // 揃える相手がいない列は、詰んだ形のまま配置済みのクロス軸中心へ合わせる
    let shift = 0;
    if (placed.size > 0) {
      const placedCrosses = [...placed.values()].map((p) => p.cross);
      shift = average(placedCrosses) - average([...stacked.values()]);
    }
    centers = new Map(
      entryIds.map((id) => [id, (stacked.get(id) ?? 0) + shift]),
    );
  } else {
    // 揃える相手がいないメンバーは、いるメンバーと同じ量だけずらした位置を希望する
    const shifts = entryIds
      .filter((id) => desired.has(id))
      .map((id) => (desired.get(id) ?? 0) - (stacked.get(id) ?? 0));
    const defaultShift = median(shifts);
    centers = placeLine(
      entryIds,
      entryCrossSize,
      (id) => desired.get(id) ?? (stacked.get(id) ?? 0) + defaultShift,
      CROSS_GAP,
    );
  }

  const mainOffsetOf = intraColumnMainOffsets(column, plan, geometry);
  for (const id of entryIds) {
    const cross = centers.get(id) ?? 0;
    if (laneByKey.has(id)) laneCrosses.set(id, cross);
    else placed.set(id, { main: centerMain + mainOffsetOf(id), cross });
  }
  return columnStart + columnMain + LAYER_GAP;
}

type Bounds = {
  minMain: number;
  maxMain: number;
  minCross: number;
  maxCross: number;
};

/** 配置済みメンバーのバウンディングボックス（空なら 0 で埋める） */
function boundsOf(
  placed: Map<string, MainCross>,
  geometry: AxisGeometry,
): Bounds {
  if (placed.size === 0) {
    return { minMain: 0, maxMain: 0, minCross: 0, maxCross: 0 };
  }
  let minMain = Number.POSITIVE_INFINITY;
  let maxMain = Number.NEGATIVE_INFINITY;
  let minCross = Number.POSITIVE_INFINITY;
  let maxCross = Number.NEGATIVE_INFINITY;
  for (const [id, center] of placed) {
    minMain = Math.min(minMain, center.main - geometry.mainSizeOf(id) / 2);
    maxMain = Math.max(maxMain, center.main + geometry.mainSizeOf(id) / 2);
    minCross = Math.min(minCross, center.cross - geometry.crossSizeOf(id) / 2);
    maxCross = Math.max(maxCross, center.cross + geometry.crossSizeOf(id) / 2);
  }
  return { minMain, maxMain, minCross, maxCross };
}

/**
 * 境界バンドを内容の外側（相手側に面した辺）に主軸方向へ並べる。
 * 各メンバーは接続相手（共通ノード）の主軸位置を希望し、同じ相手を
 * 希望するメンバーはその中心を挟んで対称に置かれる
 */
function placeBand(args: {
  ids: string[];
  side: -1 | 1;
  contentBounds: Bounds;
  plan: ContainerPlan;
  geometry: AxisGeometry;
  placed: Map<string, MainCross>;
}): void {
  const { ids, side, contentBounds, plan, geometry, placed } = args;
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
        geometry.endpointOffsetMain(placedMember, placedPoint) -
        geometry.endpointOffsetMain(movingMember, movingPoint);
      const list = desiredValues.get(movingMember);
      if (list) list.push(targetMain);
      else desiredValues.set(movingMember, [targetMain]);
    }
  }
  const fallbackMain = (contentBounds.minMain + contentBounds.maxMain) / 2;
  const centers = placeLine(
    ids,
    geometry.mainSizeOf,
    (id) => {
      const values = desiredValues.get(id);
      return values ? median(values) : fallbackMain;
    },
    MEMBER_GAP,
  );
  for (const id of ids) {
    const centerCross =
      side < 0
        ? contentBounds.minCross - CROSS_GAP - geometry.crossSizeOf(id) / 2
        : contentBounds.maxCross + CROSS_GAP + geometry.crossSizeOf(id) / 2;
    placed.set(id, {
      main: centers.get(id) ?? fallbackMain,
      cross: centerCross,
    });
  }
}

/**
 * 連結成分 1 つ分（列とバンド）を配置し、バウンディングボックスの
 * 左上（手前）を原点に正規化した中心座標群とその広がりを返す
 */
function placeComponent(
  component: PlannedComponent,
  plan: ContainerPlan,
  geometry: AxisGeometry,
): {
  centers: Map<string, MainCross>;
  mainExtent: number;
  crossExtent: number;
} {
  const placed = new Map<string, MainCross>();
  const lanePlan = planLanes(component, plan, geometry);
  const laneCrosses = new Map<string, number>();

  let columnStart = 0;
  for (const [columnIndex, column] of component.columns.entries()) {
    columnStart = placeColumn({
      column,
      columnIndex,
      columnStart,
      plan,
      geometry,
      lanePlan,
      placed,
      laneCrosses,
    });
  }

  // バンドは列に置いた内容の外側へ（バンドどうしの位置決めが
  // 連鎖しないよう、内容の広がりはここで固定する）
  const contentBounds = boundsOf(placed, geometry);
  placeBand({
    ids: component.bandStart,
    side: -1,
    contentBounds,
    plan,
    geometry,
    placed,
  });
  placeBand({
    ids: component.bandEnd,
    side: 1,
    contentBounds,
    plan,
    geometry,
    placed,
  });

  const bounds = boundsOf(placed, geometry);
  const centers = new Map<string, MainCross>();
  for (const [id, center] of placed) {
    centers.set(id, {
      main: center.main - bounds.minMain,
      cross: center.cross - bounds.minCross,
    });
  }
  return {
    centers,
    mainExtent: bounds.maxMain - bounds.minMain,
    crossExtent: bounds.maxCross - bounds.minCross,
  };
}

/** 配下すべてのポイント中心を、コンテナ内容のローカル座標で集める */
function collectPointCenters(
  members: GraphCanvasNode[],
  memberCenters: Map<string, XYPosition>,
  memberSizes: Map<string, Size>,
  finalizedGroups: Map<string, FinalizedContent>,
): Map<string, XYPosition> {
  const pointCenters = new Map<string, XYPosition>();
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
  return pointCenters;
}

/**
 * コンテナ内容のレイアウトを内側（ネストの深いグループ）から順に確定する。
 * 成分ごとに列・レーン・バンドを配置し、成分はクロス軸方向へ積む
 */
export function finalizeContainer(
  container: ContainerId,
  index: GraphIndex,
  plans: Map<ContainerId, ContainerPlan>,
  finalizedGroups: Map<string, FinalizedContent>,
  currentCenters: Map<string, XYPosition>,
): FinalizedContent {
  const members = index.childrenOf.get(container) ?? [];
  for (const member of members) {
    if (isGroupNode(member)) {
      finalizedGroups.set(
        member.id,
        finalizeContainer(
          member.id,
          index,
          plans,
          finalizedGroups,
          currentCenters,
        ),
      );
    }
  }

  const memberCenters = new Map<string, XYPosition>();
  const memberSizes = new Map<string, Size>();
  const plan = plans.get(container);
  if (!plan || members.length === 0) {
    return {
      size: { width: 0, height: 0 },
      memberCenters,
      memberSizes,
      pointCenters: new Map(),
    };
  }

  for (const member of members) {
    memberSizes.set(member.id, boxSizeOf(member, finalizedGroups));
  }
  const geometry = createAxisGeometry(
    plan.axis,
    memberSizes,
    finalizedGroups,
    currentCenters,
  );

  // 成分ごとに配置し、成分はクロス軸方向へ積む
  let componentCrossTop = 0;
  let contentMainMax = 0;
  for (const component of plan.components) {
    const { centers, mainExtent, crossExtent } = placeComponent(
      component,
      plan,
      geometry,
    );
    for (const [id, center] of centers) {
      memberCenters.set(
        id,
        geometry.toPoint(center.main, center.cross + componentCrossTop),
      );
    }
    contentMainMax = Math.max(contentMainMax, mainExtent);
    componentCrossTop += crossExtent + COMPONENT_GAP;
  }
  const contentCrossTotal = Math.max(0, componentCrossTop - COMPONENT_GAP);
  const size: Size =
    plan.axis === "x"
      ? { width: contentMainMax, height: contentCrossTotal }
      : { width: contentCrossTotal, height: contentMainMax };

  return {
    size,
    memberCenters,
    memberSizes,
    pointCenters: collectPointCenters(
      members,
      memberCenters,
      memberSizes,
      finalizedGroups,
    ),
  };
}
