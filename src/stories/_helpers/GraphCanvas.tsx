import "@xyflow/react/dist/base.css";
import "@/features/tenant/management/components/GraphEditor.css";

import {
  Background,
  ConnectionMode,
  type EdgeTypes,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import {
  GraphEdge,
  GraphEdgeMarkers,
} from "@/features/tenant/management/components/GraphEdge";
import { GraphNode } from "@/features/tenant/management/components/GraphNode";
import type { GraphData } from "@/features/tenant/management/type";
import {
  assignHandlesByPosition,
  deriveNodeHandles,
} from "@/features/tenant/management/utils/handles";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

/**
 * GraphNode / GraphEdge を単独表示するための最小 ReactFlow キャンバス
 */
export function GraphCanvas({
  nodes,
  edges,
  height = 360,
}: GraphData & { height?: number }) {
  const derivedEdges = assignHandlesByPosition(nodes, edges);
  const derivedNodes = deriveNodeHandles(nodes, derivedEdges);

  return (
    <div style={{ width: "100%", height }}>
      <ReactFlowProvider>
        <GraphEdgeMarkers />
        <ReactFlow
          nodes={derivedNodes}
          edges={derivedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
