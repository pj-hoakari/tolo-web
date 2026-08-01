import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReactFlowProvider } from "@xyflow/react";
import { fn } from "storybook/test";

import { GraphCanvas } from "@/features/tenant/management/graph/components/GraphCanvas";
import { useGraphEditor } from "@/features/tenant/management/graph/hooks/useGraphEditor";
import { useGraphViewer } from "@/features/tenant/management/graph/hooks/useGraphViewer";
import { deriveNodeNotices } from "@/features/tenant/management/graph/nodeTypes";
import { PLACEHOLDER_GRAPH } from "@/features/tenant/management/graph/placeholderGraph";
import {
  assignHandlesByPosition,
  deriveNodeHandles,
} from "@/features/tenant/management/graph/utils/handles";

const derivedEdges = assignHandlesByPosition(
  PLACEHOLDER_GRAPH.nodes,
  PLACEHOLDER_GRAPH.edges,
);
const derivedNodes = deriveNodeNotices(
  deriveNodeHandles(PLACEHOLDER_GRAPH.nodes, derivedEdges),
  derivedEdges,
);

/** 実際の編集操作（移動・接続・選択）が効く状態のキャンバス */
function EditableCanvas() {
  const { canvas } = useGraphEditor(PLACEHOLDER_GRAPH);
  return <GraphCanvas {...canvas} />;
}

/** 表示専用（移動・接続ができない）状態のキャンバス */
function ViewOnlyCanvas() {
  const { canvas } = useGraphViewer(PLACEHOLDER_GRAPH);
  return <GraphCanvas {...canvas} />;
}

const meta = {
  title: "Tenant/Management/Graph/GraphCanvas",
  component: GraphCanvas,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: 480 }}>
        <ReactFlowProvider>
          <Story />
        </ReactFlowProvider>
      </div>
    ),
  ],
  args: {
    nodes: derivedNodes,
    edges: derivedEdges,
    onNodesChange: fn(),
    onEdgesChange: fn(),
    onSelectNode: fn(),
    onSelectEdge: fn(),
    onClearSelection: fn(),
  },
} satisfies Meta<typeof GraphCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

/** editing を渡さない表示専用の状態（操作は Actions に記録される） */
export const Default: Story = {};

/** editing を渡した編集可能な状態（枠線から接続できる） */
export const Editing: Story = {
  args: {
    editing: {
      onConnect: fn(),
      isValidConnection: () => true,
      onSetEdgeDirection: fn(),
      onReverseEdge: fn(),
    },
  },
};

/** ポイントが無い状態 */
export const Empty: Story = {
  args: { nodes: [], edges: [] },
};

/** useGraphEditor と繋いだ編集可能な状態 */
export const Editable: Story = {
  render: () => <EditableCanvas />,
};

/** useGraphViewer と繋いだ表示専用の状態（選択のみできる） */
export const ViewOnly: Story = {
  render: () => <ViewOnlyCanvas />,
};
