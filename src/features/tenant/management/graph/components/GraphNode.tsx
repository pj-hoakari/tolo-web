"use client";

import {
  Handle,
  type NodeProps,
  Position,
  useConnection,
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
import { getNodeTypeDef } from "../nodeTypes";
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

/** グローバルなルート追加モードでは、ノード全体を接続領域として扱う。 */
export const GraphNodeEasyConnectContext = createContext(false);

export function GraphNode({
  id,
  data,
  selected,
  dragging,
  isConnectable,
}: NodeProps<GraphNodeType>) {
  const handles = data.handles;
  const typeDef = getNodeTypeDef(data.nodeType);
  const updateNodeInternals = useUpdateNodeInternals();
  const onUpdateLabel = useContext(GraphNodeLabelEditingContext);
  const easyConnectActive = useContext(GraphNodeEasyConnectContext);
  const connection = useConnection<GraphNodeType>();
  const isConnecting =
    connection.inProgress &&
    (connection.fromNode?.id === id || connection.toNode?.id === id);

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

  // ハンドル構成または全体接続領域が変化したら、React Flow の内部キャッシュを更新する。
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleSignature と easyConnectActive は DOM 上のハンドル構成を表すトリガーとして扱う
  useEffect(() => {
    updateNodeInternals(id);
  }, [easyConnectActive, handleSignature, id, updateNodeInternals]);

  return (
    <div className="group relative flex w-fit min-w-40 justify-center">
      <NodeFrame
        selected={selected}
        dragging={dragging}
        isConnecting={isConnecting}
      />
      <NodeTypeBadge type={data.nodeType} label={typeDef.label} />
      {/* 内容 */}
      <div className="relative min-w-0 px-4 py-5">
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
      {easyConnectActive && isConnectable ? <EasyConnectHandle /> : null}
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
      <div className="text-left font-semibold text-foreground text-sm">
        {label}
      </div>
    );
  }

  return (
    <div className="relative self-start">
      <Button
        aria-label={`「${label}」のラベルを編集`}
        variant="ghost"
        isDisabled={isEditing}
        className="nodrag nowheel h-auto min-h-0 w-fit max-w-full whitespace-normal rounded-sm px-0 py-0 text-left font-semibold text-foreground text-sm"
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
            className="nodrag nowheel h-8 w-full border-none bg-popover px-2 text-left font-semibold text-sm"
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

/** 外形は全ノード共通。操作中だけ輪郭を表示する。 */
function NodeFrame({
  selected,
  dragging,
  isConnecting,
}: {
  selected: boolean;
  dragging: boolean;
  isConnecting: boolean;
}) {
  const borderClass =
    selected || dragging || isConnecting
      ? "border-primary"
      : "border-border group-hover:border-muted-foreground group-focus-within:border-primary";

  return (
    <div
      className={`graph-node-frame pointer-events-none absolute inset-0 rounded-lg border-2 bg-card shadow-sm transition-colors ${borderClass}`}
    />
  );
}

/** タイプを示すアイコンと名前を、ノード左上のピル型バッジとして表示する。 */
function NodeTypeBadge({
  type,
  label,
}: {
  type: GraphNodeType["data"]["nodeType"];
  label: string;
}) {
  return (
    <div className="graph-node-type-badge pointer-events-none absolute -top-1 -left-1 z-10 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1">
      <NodeTypeIcon type={type} className="size-4" />
      <span className="font-medium text-[10px] text-muted-foreground">
        {label}
      </span>
    </div>
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

/** ルート追加モード中だけノード全体を覆う接続領域。 */
function EasyConnectHandle() {
  return (
    <Handle
      type="source"
      position={Position.Top}
      id="easy-connect"
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
