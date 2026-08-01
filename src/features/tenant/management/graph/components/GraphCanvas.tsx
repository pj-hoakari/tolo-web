import "@xyflow/react/dist/base.css";
import "./GraphCanvas.css";

import {
  Background,
  type Connection,
  ConnectionMode,
  Controls,
  type EdgeChange,
  type EdgeTypes,
  MiniMap,
  type NodeChange,
  type NodeTypes,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useRef } from "react";
import { DEFAULT_NODE_TYPE, getNodeTypeDef } from "../nodeTypes";
import type { GraphEdgeType, GraphNodeType } from "../type";
import { GraphEdge, GraphEdgeMarkers } from "./GraphEdge";
import { GraphNode } from "./GraphNode";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

// React Flow の既定値（50%）だと、広い会場グラフを fitView しても
// 下限で止まり、端のノードが画面外に残る。
const MIN_ZOOM = 0.01;
const FIT_VIEW_OPTIONS = { padding: 0.2, minZoom: MIN_ZOOM };

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
 * 状態は持たず、描画と入力イベントの受け渡しのみを担う。
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

  return (
    <div className="relative min-h-0 flex-1 bg-secondary">
      <GraphEdgeMarkers />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={editing?.onConnect}
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
