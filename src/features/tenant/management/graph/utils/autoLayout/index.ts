import type { GraphCanvasNode, GraphEdgeType } from "../../type";
import { isExternalNode, isPointNode } from "../../type";
import { fitGroupsToChildren, sizeOf, withAbsolutePositions } from "../groups";
import { assembleNodes } from "./assemble";
import { LAYER_GAP } from "./constants";
import { finalizeContainer } from "./finalizing";
import { buildIndex, currentCentersOf } from "./graphIndex";
import { planContainers } from "./planning";
import type { FinalizedContent } from "./types";

/**
 * 自動整列。接続（ルート）に沿って流れる階層型レイアウトを、
 * グループのネスト構造に対して再帰的に適用する。
 *
 * 1. 計画パス（planning.ts / 外側→内側）: コンテナ（キャンバス直下・
 *    各グループ）ごとに、直下メンバーへ持ち上げたルートから列（レイヤー）と
 *    列内順序を決める。
 *    - フローの軸と向きはユーザーの現在の配置から多数決で決める。
 *      縦に並べてあれば縦へ、右→左なら右→左へ。
 *    - グループをまたぐルートの端点は、相手がフロー軸方向なら端の列へ、
 *      直交方向なら内部フローと重ならないよう、相手側に面した辺の
 *      「境界バンド」へ退避させる。
 *    - 共通の流入元・流出先を持つメンバー同士のルート（兄弟ルート）は
 *      同一層内の連絡とみなし、層を分けない。
 * 2. 確定パス（finalizing.ts / 内側→外側）: 内側のグループからサイズを
 *    確定し、列を配置する際に「ルートの両端ポイントの位置」ができるだけ
 *    揃うようクロス軸方向へ寄せる。同じノードに繋がるメンバーはその中心を
 *    挟んで対称に並ぶ。列や列内のメンバーを飛び越すルートには
 *    通り道（レーン・またぎオフセット）を確保する。
 * 3. 書き戻し（assemble.ts）: 絶対座標を親相対へ戻し、グループを子へ
 *    フィットさせて確定する。
 */
export function autoAlignGraph(
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
): GraphCanvasNode[] {
  const external = nodes.find(isExternalNode);
  if (!external) return alignRoutes(nodes, edges);

  const aligned = alignRoutes(
    nodes.filter((n) => n !== external),
    edges.filter((e) => e.source !== external.id && e.target !== external.id),
  );
  const placed = placeExternal(external, aligned, edges);
  const alignedById = new Map(aligned.map((n) => [n.id, n]));
  return nodes.map((n) =>
    n === external ? placed : (alignedById.get(n.id) ?? n),
  );
}

function placeExternal(
  external: GraphCanvasNode,
  aligned: GraphCanvasNode[],
  edges: GraphEdgeType[],
): GraphCanvasNode {
  const absolute = withAbsolutePositions(aligned);
  if (absolute.length === 0) return external;

  const bottom = Math.max(
    ...absolute.map(
      (n) =>
        n.position.y +
        (isPointNode(n) ? sizeOf(n).height / 2 : sizeOf(n).height),
    ),
  );
  const connectedIds = new Set(
    edges.flatMap((e) =>
      e.source === external.id
        ? [e.target]
        : e.target === external.id
          ? [e.source]
          : [],
    ),
  );
  const connected = absolute.filter((n) => connectedIds.has(n.id));
  const xs = (
    connected.length > 0 ? connected : absolute.filter(isPointNode)
  ).map((n) => n.position.x);
  const x = xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;

  return {
    ...external,
    position: {
      x: Math.round(x),
      y: Math.round(bottom + LAYER_GAP + sizeOf(external).height / 2),
    },
  };
}

function alignRoutes(
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
): GraphCanvasNode[] {
  if (nodes.length === 0) return nodes;
  const index = buildIndex(nodes);
  const currentCenters = currentCentersOf(nodes, index);

  const plans = planContainers(index, edges, currentCenters);
  const finalizedGroups = new Map<string, FinalizedContent>();
  const root = finalizeContainer(
    undefined,
    index,
    plans,
    finalizedGroups,
    currentCenters,
  );

  const aligned = assembleNodes(
    nodes,
    index,
    root,
    finalizedGroups,
    currentCenters,
  );
  // グループ矩形を通常の編集操作と同じ規則で最終確定させる
  return fitGroupsToChildren(aligned);
}
