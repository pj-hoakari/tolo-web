import type { Connection, Viewport, XYPosition } from "@xyflow/react";
import type { GraphNodeType } from "../type";
import { findConnectionPreview, toFlowPosition } from "./connectionPreview";

/**
 * ノード全体を接続領域として扱う「ルート追加モード」。
 * - global: すべてのノードを始点にできる（キャンバスメニューから開始）
 * - from-node: 始点を固定し、終点を選ぶだけでルートを作成できる
 *   （ノードのコンテキストメニューから開始）
 */
export type EasyConnectMode =
  | { kind: "global" }
  | {
      kind: "from-node";
      sourceNodeId: string;
      /** 接続ドラッグを自動開始する際の起点（スクリーン座標） */
      origin: XYPosition;
    };

/** ルート追加モード中だけノード全体を覆うハンドルの ID */
export const EASY_CONNECT_HANDLE_ID = "easy-connect";

/**
 * モード終了後に片付け切れていないドラッグから届いた
 * easy-connect 由来の接続かどうか。true のときは反映してはならない。
 */
export function isStaleEasyConnection(
  connection: Connection,
  modeActive: boolean,
): boolean {
  return (
    !modeActive &&
    (connection.sourceHandle === EASY_CONNECT_HANDLE_ID ||
      connection.targetHandle === EASY_CONNECT_HANDLE_ID)
  );
}

/** 始点固定モードで終点を確定できずにリリースしたときの次の挙動 */
export type FromNodeReleasePlan =
  | { kind: "restart"; origin: XYPosition }
  | { kind: "end" };

/**
 * 始点固定モードのリリース位置から次の挙動を決める。
 * 接続できなかったノードの近くなら、その位置からドラッグを再開して
 * 終点を選び直せるようにし、何もない場所ならモードごと終了する。
 */
export function planFromNodeRelease(params: {
  /** リリース時のポインタ位置（キャンバス座標系） */
  pointer: XYPosition | null;
  /** リリース時のスクリーン座標。取得できない（タッチ等）場合は null */
  releasePoint: XYPosition | null;
  viewport: Viewport;
  nodes: GraphNodeType[];
  sourceNodeId: string;
}): FromNodeReleasePlan {
  const { pointer, releasePoint, viewport, nodes, sourceNodeId } = params;
  const nearNode =
    pointer !== null &&
    findConnectionPreview(
      toFlowPosition(pointer, viewport),
      nodes,
      sourceNodeId,
    ) !== null;
  return nearNode && releasePoint
    ? { kind: "restart", origin: releasePoint }
    : { kind: "end" };
}
