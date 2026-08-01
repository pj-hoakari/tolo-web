import "@xyflow/react/dist/base.css";
import "./GraphCanvas.css";

import {
  Background,
  type Connection,
  type ConnectionLineComponentProps,
  ConnectionMode,
  Controls,
  type EdgeChange,
  type EdgeTypes,
  getBezierPath,
  MiniMap,
  type NodeChange,
  type NodeTypes,
  type OnConnectStart,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_NODE_TYPE, getNodeTypeDef } from "../nodeTypes";
import type { GraphEdgeType, GraphNodeType, HandleSide } from "../type";
import { addVirtualHandle } from "../utils/handles";
import { GraphEdge, GraphEdgeMarkers } from "./GraphEdge";
import { GraphNode } from "./GraphNode";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

// React Flow の既定値（50%）だと、広い会場グラフを fitView しても
// 下限で止まり、端のノードが画面外に残る。
const MIN_ZOOM = 0.01;
const FIT_VIEW_OPTIONS = { padding: 0.2, minZoom: MIN_ZOOM };
const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

type VirtualHandle = { nodeId: string; side: HandleSide };

function VirtualConnectionLine({
  virtualHandle,
  fromHandle,
  fromNode,
  fromPosition,
  fromX,
  fromY,
  toPosition,
  toX,
  toY,
  connectionLineStyle,
}: ConnectionLineComponentProps<GraphNodeType> & {
  virtualHandle: VirtualHandle;
}) {
  const virtualSlot = fromNode.data.handles?.[virtualHandle.side].find(
    (slot) => slot.virtual,
  );
  const shouldUseVirtualSlot =
    fromNode.id === virtualHandle.nodeId &&
    fromHandle.id === `connect-${virtualHandle.side}` &&
    virtualSlot !== undefined;
  const source = shouldUseVirtualSlot
    ? virtualSlotPosition(fromNode, virtualSlot)
    : { x: fromX, y: fromY };
  const [path] = getBezierPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  return (
    <path
      d={path}
      fill="none"
      className="react-flow__connection-path"
      style={connectionLineStyle}
    />
  );
}

function virtualSlotPosition(
  node: ConnectionLineComponentProps<GraphNodeType>["fromNode"],
  slot: { side: HandleSide; index: number; total: number },
) {
  const width = node.measured.width ?? node.width ?? 0;
  const height = node.measured.height ?? node.height ?? 0;
  const position = (slot.index + 1) / (slot.total + 1);
  const { x, y } = node.internals.positionAbsolute;

  switch (slot.side) {
    case "top":
      return { x: x + width * position, y };
    case "right":
      return { x: x + width, y: y + height * position };
    case "bottom":
      return { x: x + width * position, y: y + height };
    case "left":
      return { x, y: y + height * position };
  }
}

/** ノードの実寸法が確定してから、初回だけグラフ全体を表示する。 */
function InitialFitView({ hasNodes }: { hasNodes: boolean }) {
  const nodesInitialized = useNodesInitialized();
  const { fitView, viewportInitialized } = useReactFlow<
    GraphNodeType,
    GraphEdgeType
  >();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (
      !hasNodes ||
      !nodesInitialized ||
      !viewportInitialized ||
      hasFitted.current
    )
      return;

    hasFitted.current = true;
    void fitView(FIT_VIEW_OPTIONS);
  }, [fitView, hasNodes, nodesInitialized, viewportInitialized]);

  return null;
}

/** グラフ構造そのものを編集するためのハンドラ一式 */
export type GraphCanvasEditing = {
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Connection | GraphEdgeType) => boolean;
};

export type GraphCanvasProps = {
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  /** 寸法計測・選択状態の反映に必要なため、表示専用でも受け取る */
  onNodesChange: (changes: NodeChange<GraphNodeType>[]) => void;
  onEdgesChange: (changes: EdgeChange<GraphEdgeType>[]) => void;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onClearSelection: () => void;
  /**
   * 構造編集のハンドラ。
   * 渡さないときは表示専用（移動・接続・削除ができない）キャンバスになる。
   */
  editing?: GraphCanvasEditing;
};

/**
 * 会場グラフを描画する ReactFlow キャンバス。
 * グラフ本体の状態は持たず、描画と入力イベントの受け渡しを担う。
 * 接続ドラッグ中だけは端点をずらすための一時的な描画状態を持つ。
 * 呼び出し側で ReactFlowProvider の内側に置くこと。
 */
export function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  editing,
}: GraphCanvasProps) {
  const editable = editing !== undefined;
  const [virtualHandle, setVirtualHandle] = useState<VirtualHandle | null>(
    null,
  );
  const displayNodes = useMemo(
    () =>
      virtualHandle
        ? addVirtualHandle(nodes, virtualHandle.nodeId, virtualHandle.side)
        : nodes,
    [nodes, virtualHandle],
  );
  const handleConnectStart = useCallback<OnConnectStart>((_, params) => {
    const side = params.handleId?.replace("connect-", "") as HandleSide;
    if (!params.nodeId || !SIDES.includes(side)) return;
    setVirtualHandle({ nodeId: params.nodeId, side });
  }, []);
  const handleConnectEnd = useCallback(() => setVirtualHandle(null), []);
  const connectionLineComponent = useCallback(
    (props: ConnectionLineComponentProps<GraphNodeType>) =>
      virtualHandle ? (
        <VirtualConnectionLine {...props} virtualHandle={virtualHandle} />
      ) : null,
    [virtualHandle],
  );

  return (
    <div className="relative min-h-0 flex-1 bg-secondary">
      <GraphEdgeMarkers />
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={editing?.onConnect}
        onConnectStart={editable ? handleConnectStart : undefined}
        onConnectEnd={editable ? handleConnectEnd : undefined}
        connectionLineComponent={
          virtualHandle ? connectionLineComponent : undefined
        }
        isValidConnection={editing?.isValidConnection}
        // 表示専用のときは選択だけを許し、構造を変える操作は塞ぐ
        nodesDraggable={editable}
        nodesConnectable={editable}
        deleteKeyCode={editable ? ["Delete", "Backspace"] : null}
        onNodeClick={(_, n) => onSelectNode(n.id)}
        onEdgeClick={(_, e) => onSelectEdge(e.id)}
        onPaneClick={onClearSelection}
        connectionMode={ConnectionMode.Loose}
        minZoom={MIN_ZOOM}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
      >
        <InitialFitView hasNodes={nodes.length > 0} />
        <Background gap={20} size={1} />
        <Controls
          position="bottom-right"
          showInteractive={editable}
          fitViewOptions={FIT_VIEW_OPTIONS}
        />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n: GraphNodeType) =>
            getNodeTypeDef(n.data?.nodeType ?? DEFAULT_NODE_TYPE).color
          }
        />
      </ReactFlow>
    </div>
  );
}
