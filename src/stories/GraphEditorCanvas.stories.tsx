import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReactFlowProvider } from "@xyflow/react";
import { fn } from "storybook/test";

import { GraphEditorCanvas } from "@/features/tenant/management/graphEditor/components/GraphEditorCanvas";
import { useGraphEditor } from "@/features/tenant/management/graphEditor/hooks/useGraphEditor";
import { deriveNodeNotices } from "@/features/tenant/management/graphEditor/nodeTypes";
import { PLACEHOLDER_GRAPH } from "@/features/tenant/management/graphEditor/placeholderGraph";
import {
  assignHandlesByPosition,
  deriveNodeHandles,
} from "@/features/tenant/management/graphEditor/utils/handles";

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
  return <GraphEditorCanvas {...canvas} />;
}

const meta = {
  title: "Tenant/Management/GraphEditor/GraphEditorCanvas",
  component: GraphEditorCanvas,
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
    onConnect: fn(),
    isValidConnection: () => true,
    onSelectNode: fn(),
    onSelectEdge: fn(),
    onClearSelection: fn(),
  },
} satisfies Meta<typeof GraphEditorCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 状態を持たない表示のみ（操作は Actions に記録される） */
export const Default: Story = {};

/** ポイントが無い状態 */
export const Empty: Story = {
  args: { nodes: [], edges: [] },
};

/** useGraphEditor と繋いだ編集可能な状態 */
export const Editable: Story = {
  render: () => <EditableCanvas />,
};
