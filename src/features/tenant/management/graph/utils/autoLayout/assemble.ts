import type { XYPosition } from "@xyflow/react";
import { type GraphCanvasNode, isGroupNode, isPointNode } from "../../type";
import { GROUP_FIT_PADDING_TOP, GROUP_FIT_PADDING_X, sizeOf } from "../groups";
import type { ContainerId, FinalizedContent, GraphIndex, Size } from "./types";

/**
 * 確定したレイアウトを絶対座標へ展開し、既存の座標系の約束
 * （ポイント = 中心、グループ = 左上、子は親相対）に従って
 * 各ノードの position へ書き戻した新しい配列を返す
 */
export function assembleNodes(
  nodes: GraphCanvasNode[],
  index: GraphIndex,
  root: FinalizedContent,
  finalizedGroups: Map<string, FinalizedContent>,
  currentCenters: Map<string, XYPosition>,
): GraphCanvasNode[] {
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
  return nodes.map((node): GraphCanvasNode => {
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
}
