"use client";

import "@xyflow/react/dist/base.css";
import "./GraphEditor.css";

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
import { type Ref, useImperativeHandle } from "react";
import { useAliveEdges } from "@/features/tenant/webrtc/hooks/useAliveEdges";
import { useGraphEditor } from "../hooks/useGraphEditor";
import { DEFAULT_NODE_TYPE, getNodeTypeDef } from "../nodeTypes";
import type { GraphData, GraphNodeType } from "../type";
import { GraphEdge, GraphEdgeMarkers } from "./GraphEdge";
import { GraphNode } from "./GraphNode";
import { GraphToolbar } from "./GraphToolbar";
import { PropertiesPanel } from "./PropertiesPanel";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

export type GraphEditorHandle = {
  getGraphData: () => GraphData;
};

type GraphEditorProps = {
  tenantId: string;
  eventId: string;
  initialGraph?: GraphData;
};

function GraphEditorInner({
  tenantId,
  eventId,
  initialGraph,
  handleRef,
}: GraphEditorProps & { handleRef?: Ref<GraphEditorHandle> }) {
  const {
    nodes,
    edges,
    selectedNode,
    selectedEdge,
    usedObservationPointIds,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    addNode,
    deleteSelection,
    updateNodeData,
    updateEdgeData,
    reverseEdge,
    linkObservationPoints,
    selectNode,
    selectEdge,
    clearSelection,
    getGraphData,
  } = useGraphEditor(initialGraph);

  // 紐づけ候補となる観測点（接続中のエッジ）一覧
  const {
    edges: observationPoints,
    status: observationPointsStatus,
    refresh: refreshObservationPoints,
  } = useAliveEdges({ tenantId, eventId });

  // 親から ref 経由で編集済みデータを取得できるように
  useImperativeHandle(handleRef, () => ({ getGraphData }), [getGraphData]);

  const handleSave = () => {
    const graph = getGraphData();
    // TODO: API 送信に差し替え
    console.log(graph);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphToolbar onAddNode={addNode} onSave={handleSave} />
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
        <PropertiesPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          nodes={nodes}
          edges={edges}
          observationPoints={observationPoints}
          observationPointsStatus={observationPointsStatus}
          usedObservationPointIds={usedObservationPointIds}
          onRefreshObservationPoints={refreshObservationPoints}
          onUpdateNode={updateNodeData}
          onUpdateEdge={updateEdgeData}
          onReverseEdge={reverseEdge}
          onLinkObservationPoints={linkObservationPoints}
          onDelete={deleteSelection}
        />
      </div>
    </div>
  );
}

export function GraphEditor({
  tenantId,
  eventId,
  initialGraph,
  ref,
}: GraphEditorProps & { ref?: Ref<GraphEditorHandle> }) {
  return (
    <ReactFlowProvider>
      <GraphEditorInner
        tenantId={tenantId}
        eventId={eventId}
        initialGraph={initialGraph}
        handleRef={ref}
      />
    </ReactFlowProvider>
  );
}
