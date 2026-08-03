"use client";

import {
  type NodeProps,
  useConnection,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useContext, useEffect, useMemo } from "react";
import { getNodeTypeDef } from "../nodeTypes";
import type { GraphNodeType } from "../type";
import { makeHandleId, SIDES } from "../utils/handles";
import {
  GraphNodeEasyConnectContext,
  GraphNodeLabelEditingContext,
} from "./canvasContexts";
import { InlineNodeLabel } from "./InlineNodeLabel";
import { NodeTypeIcon } from "./NodeTypeIcon";
import {
  BorderConnectionHandle,
  EasyConnectHandle,
  HandlePort,
} from "./nodeHandles";

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
  const easyConnectMode = useContext(GraphNodeEasyConnectContext);
  const easyConnectActive = easyConnectMode !== null;
  const canStartEasyConnect =
    easyConnectMode?.kind !== "from-node" ||
    easyConnectMode.sourceNodeId === id;
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleSignature と easyConnectMode は DOM 上のハンドル構成を表すトリガーとして扱う
  useEffect(() => {
    updateNodeInternals(id);
  }, [easyConnectMode, handleSignature, id, updateNodeInternals]);

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
      {easyConnectActive && isConnectable ? (
        <EasyConnectHandle canStart={canStartEasyConnect} />
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
