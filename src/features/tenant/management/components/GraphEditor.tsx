"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  ConnectionMode,
  Controls,
  type EdgeTypes,
  MiniMap,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useGraphEditor } from "../hooks/useGraphEditor";
import { GraphEdge, GraphEdgeMarkers } from "./GraphEdge";
import { GraphNode } from "./GraphNode";
import { GraphToolbar } from "./GraphToolbar";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

function GraphEditorInner() {
  const {
    nodes,
    edges,
    hasSelection,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    addNode,
    deleteSelection,
    selectNode,
    selectEdge,
    clearSelection,
  } = useGraphEditor();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphToolbar
        hasSelection={hasSelection}
        onAddNode={addNode}
        onDeleteSelection={deleteSelection}
      />
      <div className="relative min-h-0 flex-1">
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
          onNodeClick={(_, n) => selectNode(n.id)}
          onEdgeClick={(_, e) => selectEdge(e.id)}
          onPaneClick={clearSelection}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={["Delete", "Backspace"]}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background gap={20} size={1} color="#d4d4d8" />
          <Controls position="bottom-right" />
          <MiniMap
            pannable
            zoomable
            nodeColor={() => "#0ea5e9"}
            maskColor="rgba(0,0,0,0.08)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function GraphEditor() {
  return (
    <ReactFlowProvider>
      <GraphEditorInner />
    </ReactFlowProvider>
  );
}
