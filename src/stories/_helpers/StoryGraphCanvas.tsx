import "@xyflow/react/dist/base.css";
import "@/features/tenant/management/graphEditor/components/GraphEditor.css";

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
} from "@/features/tenant/management/graphEditor/components/GraphEdge";
import { GraphNode } from "@/features/tenant/management/graphEditor/components/GraphNode";
import type { GraphData } from "@/features/tenant/management/graphEditor/type";
import {
  assignHandlesByPosition,
  deriveNodeHandles,
} from "@/features/tenant/management/graphEditor/utils/handles";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

/**
 * GraphNode / GraphEdge を単独表示するための最小 ReactFlow キャンバス
 * （機能側の `GraphCanvas` と違い、ツールバーや MiniMap を持たない Story 専用）
 */
export function StoryGraphCanvas({
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
