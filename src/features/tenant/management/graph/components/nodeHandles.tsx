"use client";

import { Handle, Position } from "@xyflow/react";
import type { HandleSide, HandleSlot } from "../type";
import { EASY_CONNECT_HANDLE_ID } from "../utils/easyConnect";
import { connectHandleId, makeHandleId } from "../utils/handles";

/** HandleSide を React Flow の Position に対応づける */
export const positionBySide: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** エッジ端点用の不可視ハンドル。安定した ID で登録し、配置だけを接続状況に応じて変える。 */
export function HandlePort({
  side,
  index,
  layoutSlot,
  fallbackTotal,
}: {
  side: HandleSide;
  index: number;
  layoutSlot?: HandleSlot;
  fallbackTotal: number;
}) {
  const slot = layoutSlot ?? {
    side,
    // 未使用の内部アンカーは、次に追加される端点と同じ位置に置く。
    index: Math.min(index, fallbackTotal - 1),
    total: fallbackTotal,
  };
  const horizontal = side === "top" || side === "bottom";
  const percentage = ((slot.index + 1) / (slot.total + 1)) * 100;
  const style = horizontal
    ? { left: `${percentage}%` }
    : { top: `${percentage}%` };

  return (
    <Handle
      type="source"
      position={positionBySide[side]}
      id={makeHandleId(side, index)}
      style={style}
      className="rounded-none! border-0! bg-transparent!"
    />
  );
}

/** 新規接続用。空きスロットを確保せず、各辺全体を接続領域にする。 */
export function BorderConnectionHandle({ side }: { side: HandleSide }) {
  const horizontal = side === "top" || side === "bottom";
  const style = horizontal
    ? { width: "100%", height: 12 }
    : { width: 12, height: "100%" };

  return (
    <Handle
      type="source"
      position={positionBySide[side]}
      id={connectHandleId(side)}
      style={style}
      className="rounded-none! border-0! bg-transparent!"
    />
  );
}

/** ルート追加モード中だけノード全体を覆う接続領域。 */
export function EasyConnectHandle({ canStart }: { canStart: boolean }) {
  return (
    <Handle
      type="source"
      position={Position.Top}
      id={EASY_CONNECT_HANDLE_ID}
      isConnectableStart={canStart}
      style={{
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        transform: "none",
      }}
      className="pointer-events-auto! z-20! rounded-lg! border-0! bg-transparent! opacity-0!"
    />
  );
}
