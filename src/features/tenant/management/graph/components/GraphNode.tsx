"use client";

import {
  Handle,
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { getNodeTypeDef, type NodeShape } from "../nodeTypes";
import type { GraphNodeType, HandleSide, HandleSlot } from "../type";
import { NodeTypeIcon } from "./NodeTypeIcon";

const positionMap: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

export function GraphNode({
  id,
  data,
  selected,
  isConnectable,
}: NodeProps<GraphNodeType>) {
  const handles = data.handles;
  const typeDef = getNodeTypeDef(data.nodeType);
  const shape = typeDef.shape;
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
    <div className="group relative min-w-40 drop-shadow-md">
      <NodeFrame shape={shape} selected={selected} />
      {/* 内容 */}
      <div
        className={[
          "relative flex min-h-14 flex-col justify-center px-3 py-2",
          shape.contentClassName ?? "",
        ].join(" ")}
      >
        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <NodeTypeIcon type={data.nodeType} />
          {typeDef.label}
        </div>
        <div className="text-center font-semibold text-foreground text-sm">
          {data.label}
        </div>
      </div>

      {handles
        ? SIDES.flatMap((side) =>
            handles[side]
              // 接続できないキャンバス（表示専用）では空きスロットを出さない。
              // 使用中のスロットはエッジ端点の座標計算に必要なため常に描画する。
              .filter((slot) => isConnectable || slot.used)
              .map((slot) => <HandlePort key={slot.id} slot={slot} />),
          )
        : null}
    </div>
  );
}

/** 塗りと枠線をひとつの図形として描画し、線幅の歪みを防ぐ。 */
function NodeFrame({
  shape,
  selected,
}: {
  shape: NodeShape;
  selected: boolean;
}) {
  const borderClass = selected
    ? "border-primary"
    : "border-muted-foreground group-hover:border-muted-foreground/40";
  const strokeClass = selected
    ? "text-primary"
    : "text-muted-foreground group-hover:text-muted-foreground/40";

  if (shape.kind === "rounded") {
    return (
      <div
        className={`absolute inset-0 border-2 bg-card transition-colors ${borderClass}`}
        style={{ borderRadius: shape.borderRadius }}
      />
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible transition-colors ${strokeClass}`}
      preserveAspectRatio="none"
      viewBox="-1 -1 102 102"
    >
      <polygon
        fill="var(--card)"
        points={shape.points}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function HandlePort({ slot }: { slot: HandleSlot }) {
  const percentage = ((slot.index + 1) / (slot.total + 1)) * 100;
  const style =
    slot.side === "top" || slot.side === "bottom"
      ? { left: `${percentage}%` }
      : { top: `${percentage}%` };

  const cls = slot.used
    ? "!h-2.5 !w-2.5 !rounded-full !border-2 !border-card !bg-muted-foreground"
    : "!h-2.5 !w-2.5 !rounded-full !border !border-muted-foreground !bg-secondary hover:!bg-primary/10";

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
