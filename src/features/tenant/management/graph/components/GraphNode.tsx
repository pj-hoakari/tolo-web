"use client";

import {
  Handle,
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from "@xyflow/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input, TextField } from "@/components/ui/textfield";
import { getNodeTypeDef, type NodeShape } from "../nodeTypes";
import type { GraphNodeType, HandleSide, HandleSlot } from "../type";
import { makeHandleId } from "../utils/handles";
import { NodeTypeIcon } from "./NodeTypeIcon";

const positionMap: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

/** 編集キャンバスからノード内ラベル編集を受け取るためのコールバック。 */
export const GraphNodeLabelEditingContext = createContext<
  ((id: string, label: string) => void) | undefined
>(undefined);

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
  const onUpdateLabel = useContext(GraphNodeLabelEditingContext);

  // ハンドル構成（id・index・total）が変化したら React Flow の内部キャッシュを更新し、
  // エッジ端点の座標を再計算させる。
  const handleSignature = useMemo(() => {
    if (!handles) return "";
    return SIDES.map((side) =>
      handles[side].map((s) => `${s.id}:${s.index}/${s.total}`).join(","),
    ).join("|");
  }, [handles]);

  // 接続可能な領域は BorderConnectionHandle が担うため、ここに空きスロットという
  // UI 上の概念はない。一方で React Flow は edge.sourceHandle / targetHandle が
  // 評価される時点で同じ ID の Handle が登録済みであることを求める。
  //
  // 辺の追加・移動・仮想端点の追加では、派生した端点 ID の反映より先に Edge が
  // 再計算されることがある。ノードの接続数 + 1 件分を各辺に常時登録しておくことで、
  // 次の端点 ID も含めてこの短い同期ずれを吸収する。これらは不可視の内部アンカーで、
  // 新規接続できる場所や表示上のスロットを増やすものではない。
  const endpointHandleCount =
    1 +
    SIDES.reduce(
      (count, side) =>
        count + (handles?.[side].filter((slot) => !slot.virtual).length ?? 0),
      0,
    );

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
        <InlineNodeLabel id={id} label={data.label} onUpdate={onUpdateLabel} />
      </div>

      {SIDES.flatMap((side) =>
        Array.from({ length: endpointHandleCount }, (_, index) => (
          <HandlePort
            key={makeHandleId(side, index)}
            side={side}
            index={index}
            layoutSlot={handles?.[side].find((slot) => slot.index === index)}
            fallbackTotal={(handles?.[side].length ?? 0) + 1}
          />
        )),
      )}
      {isConnectable
        ? SIDES.map((side) => <BorderConnectionHandle key={side} side={side} />)
        : null}
    </div>
  );
}

function InlineNodeLabel({
  id,
  label,
  onUpdate,
}: {
  id: string;
  label: string;
  onUpdate: ((id: string, label: string) => void) | undefined;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const isFinishing = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraftLabel(label);
  }, [isEditing, label]);

  const startEditing = () => {
    isFinishing.current = false;
    setDraftLabel(label);
    setIsEditing(true);
  };

  const finishEditing = (commit: boolean) => {
    if (isFinishing.current) return;
    isFinishing.current = true;
    if (commit && draftLabel !== label) onUpdate?.(id, draftLabel);
    setIsEditing(false);
  };

  if (!onUpdate) {
    return (
      <div className="text-center font-semibold text-foreground text-sm">
        {label}
      </div>
    );
  }

  return (
    <div className="relative self-center">
      <Button
        aria-label={`「${label}」のラベルを編集`}
        variant="ghost"
        isDisabled={isEditing}
        className="nodrag nowheel h-auto min-h-0 w-fit max-w-full whitespace-normal rounded-sm px-1 py-0 font-semibold text-foreground text-sm"
        onPointerDown={(event) => event.stopPropagation()}
        onPress={startEditing}
      >
        {label}
      </Button>
      {isEditing ? (
        <TextField
          value={draftLabel}
          onChange={setDraftLabel}
          className="absolute top-1/2 left-1/2 z-10 w-56 -translate-x-1/2 -translate-y-1/2"
        >
          <Input
            aria-label="ポイントのラベル"
            autoFocus
            className="nodrag nowheel h-8 w-full bg-popover px-2 text-center font-semibold text-sm shadow-lg"
            onBlur={() => finishEditing(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                finishEditing(true);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                finishEditing(false);
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </TextField>
      ) : null}
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

function HandlePort({
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

  // エッジの端点は安定した ID で登録し、配置だけを接続状況に応じて変える。
  return (
    <Handle
      type="source"
      position={positionMap[side]}
      id={makeHandleId(side, index)}
      style={style}
      className="rounded-none! border-0! bg-transparent!"
    />
  );
}

/** 新規接続用。空きスロットを確保せず、各辺全体を接続領域にする。 */
function BorderConnectionHandle({ side }: { side: HandleSide }) {
  const horizontal = side === "top" || side === "bottom";
  const style = horizontal
    ? { width: "100%", height: 12 }
    : { width: 12, height: "100%" };

  return (
    <Handle
      type="source"
      position={positionMap[side]}
      id={`connect-${side}`}
      style={style}
      className="rounded-none! border-0! bg-transparent!"
    />
  );
}
