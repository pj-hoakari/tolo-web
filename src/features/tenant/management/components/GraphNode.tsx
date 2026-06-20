"use client";

import {
  Handle,
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { getNodeTypeDef } from "../nodeTypes";
import type { GraphNodeType, HandleSide, HandleSlot } from "../type";

const positionMap: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

export function GraphNode({ id, data, selected }: NodeProps<GraphNodeType>) {
  const handles = data.handles;
  const typeDef = getNodeTypeDef(data.nodeType);
  const updateNodeInternals = useUpdateNodeInternals();

  // ハンドル構成（id・index・total）が変化したら React Flow の内部キャッシュを更新し、
  // エッジ端点の座標を再計算させる。
  const handleSignature = useMemo(() => {
    if (!handles) return "";
    return SIDES.map((side) =>
      handles[side].map((s) => `${s.id}:${s.index}/${s.total}`).join(","),
    ).join("|");
  }, [handles]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleSignature をトリガー依存として扱う
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleSignature, updateNodeInternals]);

  return (
    <div
      className={[
        "relative min-w-40 rounded-lg border bg-white px-3 py-2 shadow-sm transition",
        selected
          ? "border-sky-500 ring-2 ring-sky-200"
          : "border-zinc-300 hover:border-zinc-400",
      ].join(" ")}
    >
      <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: typeDef.color }}
        />
        {typeDef.label}
      </div>
      <div className="text-center font-semibold text-sm text-zinc-900">
        {data.label}
      </div>

      {handles
        ? SIDES.flatMap((side) =>
            handles[side].map((slot) => (
              <HandlePort key={slot.id} slot={slot} />
            )),
          )
        : null}
    </div>
  );
}

function HandlePort({ slot }: { slot: HandleSlot }) {
  const percentage = ((slot.index + 1) / (slot.total + 1)) * 100;
  const style =
    slot.side === "top" || slot.side === "bottom"
      ? { left: `${percentage}%` }
      : { top: `${percentage}%` };

  const cls = slot.used
    ? "!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-sky-500"
    : "!h-2.5 !w-2.5 !rounded-full !border !border-sky-400 !bg-white hover:!bg-sky-100";

  return (
    <Handle
      type="source"
      position={positionMap[slot.side]}
      id={slot.id}
      style={style}
      className={cls}
    />
  );
}
