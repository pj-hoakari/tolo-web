import "@xyflow/react/dist/base.css";
import "./GraphEditor.css";

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
} from "@xyflow/react";
import { DEFAULT_NODE_TYPE, getNodeTypeDef } from "../nodeTypes";
import type { GraphEdgeType, GraphNodeType } from "../type";
import { GraphEdge, GraphEdgeMarkers } from "./GraphEdge";
import { GraphNode } from "./GraphNode";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

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
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background gap={20} size={1} />
        <Controls position="bottom-right" showInteractive={editable} />
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
