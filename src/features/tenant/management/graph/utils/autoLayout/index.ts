import type { GraphCanvasNode, GraphEdgeType } from "../../type";
import { fitGroupsToChildren } from "../groups";
import { assembleNodes } from "./assemble";
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
