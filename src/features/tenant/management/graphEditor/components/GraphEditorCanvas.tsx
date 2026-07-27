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

export type GraphEditorCanvasProps = {
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  onNodesChange: (changes: NodeChange<GraphNodeType>[]) => void;
  onEdgesChange: (changes: EdgeChange<GraphEdgeType>[]) => void;
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Connection | GraphEdgeType) => boolean;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onClearSelection: () => void;
};

/**
 * 会場グラフを編集する ReactFlow キャンバス。
 * 状態は持たず、描画と入力イベントの受け渡しのみを担う。
 * 呼び出し側で ReactFlowProvider の内側に置くこと。
 */
export function GraphEditorCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
}: GraphEditorCanvasProps) {
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
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_, n) => onSelectNode(n.id)}
        onEdgeClick={(_, e) => onSelectEdge(e.id)}
        onPaneClick={onClearSelection}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={["Delete", "Backspace"]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background gap={20} size={1} />
        <Controls position="bottom-right" />
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
