import {
  type NoticeTranslator,
  type ValidationResult,
  validateEdgeDirection,
  validateReverseEdge,
} from "../../nodeTypes";
import type { EdgeDirection, GraphCanvasNode, GraphEdgeType } from "../../type";

/** 方向トグルと反転ボタンの操作可否・理由をまとめた表示用の状態 */
export type EdgeDirectionState = {
  direction: EdgeDirection;
  bothDisabled: boolean;
  onewayDisabled: boolean;
  /** 方向を変更できない理由。制約違反が無ければ null */
  directionReason: string | null;
  reverseDisabled: boolean;
  /** 反転できない理由。両通行時は反転操作自体が無意味なため null */
  reverseReason: string | null;
};

/**
 * 各検証結果から方向操作の表示状態を導出する。
 * 選択中の方向は制約違反であっても操作を塞がないよう常に選択可能とする。
 */
export function deriveEdgeDirectionState(
  direction: EdgeDirection,
  bothResult: ValidationResult,
  onewayResult: ValidationResult,
  reverseResult: ValidationResult,
  translateNotice: NoticeTranslator,
): EdgeDirectionState {
  return {
    direction,
    bothDisabled: direction !== "both" && !bothResult.ok,
    onewayDisabled: direction !== "oneway" && !onewayResult.ok,
    directionReason: !bothResult.ok
      ? translateNotice(bothResult.messageKey)
      : !onewayResult.ok
        ? translateNotice(onewayResult.messageKey)
        : null,
    // 両通行のルートは向きの概念が無いため反転できない
    reverseDisabled: direction === "both" || !reverseResult.ok,
    reverseReason:
      direction !== "both" && !reverseResult.ok
        ? translateNotice(reverseResult.messageKey)
        : null,
  };
}

/** 現在のグラフ状態から、エッジの方向操作の可否を解決する */
export function resolveEdgeDirectionState(
  edge: GraphEdgeType,
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
  translateNotice: NoticeTranslator,
): EdgeDirectionState {
  return deriveEdgeDirectionState(
    edge.data?.direction ?? "both",
    validateEdgeDirection(edge, "both", nodes, edges),
    validateEdgeDirection(edge, "oneway", nodes, edges),
    validateReverseEdge(edge, nodes, edges),
    translateNotice,
  );
}
