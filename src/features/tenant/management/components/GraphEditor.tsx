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
import { DEFAULT_NODE_TYPE, getNodeTypeDef } from "../nodeTypes";
import type { GraphData, GraphNodeType } from "../type";
import { GraphEdge, GraphEdgeMarkers } from "./GraphEdge";
import { GraphNode } from "./GraphNode";
import { GraphToolbar } from "./GraphToolbar";
import { PropertiesPanel } from "./PropertiesPanel";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

function GraphEditorInner({ initialGraph }: { initialGraph?: GraphData }) {
  const {
    nodes,
    edges,
    selectedNode,
    selectedEdge,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    addNode,
    deleteSelection,
    updateNodeData,
    updateEdgeData,
    reverseEdge,
    selectNode,
    selectEdge,
    clearSelection,
  } = useGraphEditor(initialGraph);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphToolbar onAddNode={addNode} />
      <div className="flex min-h-0 flex-1">
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
              nodeColor={(n: GraphNodeType) =>
                getNodeTypeDef(n.data?.nodeType ?? DEFAULT_NODE_TYPE).color
              }
              maskColor="rgba(0,0,0,0.08)"
            />
          </ReactFlow>
        </div>
        <PropertiesPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          nodes={nodes}
          edges={edges}
          onUpdateNode={updateNodeData}
          onUpdateEdge={updateEdgeData}
          onReverseEdge={reverseEdge}
          onDelete={deleteSelection}
        />
      </div>
    </div>
  );
}

export function GraphEditor({ initialGraph }: { initialGraph?: GraphData }) {
  return (
    <ReactFlowProvider>
      <GraphEditorInner initialGraph={initialGraph} />
    </ReactFlowProvider>
  );
}
