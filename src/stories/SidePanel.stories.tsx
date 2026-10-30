import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { SidePanel } from "@/features/tenant/management/graph/components/sidePanel/SidePanel";
import {
  BOUNDARY_EDGES,
  BOUNDARY_NODES,
  boundaryFixtureNode,
  GRAPH_EDGES,
  GRAPH_NODES,
  graphEdge,
  graphNode,
} from "./_helpers/propertiesFixtures";

const meta = {
  title: "Tenant/Management/Graph/SidePanel",
  component: SidePanel,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: 480 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    graph: { nodes: GRAPH_NODES, edges: GRAPH_EDGES },
    selectedNode: undefined,
    selectedEdge: undefined,
    labelLocale: "ja",
    onUpdateNode: fn(),
    onSetNodeLabel: fn(),
    onUpdateEdge: fn(),
    onReverseEdge: fn(),
    edgeTargets: [],
    onAddEdge: fn(),
    onSetSelectedNodeFlag: fn(),
    onSetSelectedEdgeDirection: fn(),
    onReverseSelectedEdges: fn(),
    bulkResult: null,
    onDelete: fn(),
    onDeleteSelected: fn(),
    canDeleteSelected: false,
    onGroupSelected: fn(),
    groupSelectionError: "tooFewPoints",
    onSelectNode: fn(),
    onSelectEdge: fn(),
  },
} satisfies Meta<typeof SidePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoSelection: Story = {};

export const NodeSelected: Story = {
  args: {
    // ブースA（GOAL）を選択した状態
    selectedNode: graphNode("ph_booth"),
  },
};

export const EdgeSelected: Story = {
  args: {
    // junction → booth（両通行）を選択した状態
    selectedEdge: graphEdge("ph_e2"),
  },
};

export const GroupSelected: Story = {
  args: {
    selectedNode: GRAPH_NODES.find((node) => node.id === "ph_floor1"),
  },
};

export const Boundary: Story = {
  args: {
    // 外部ポイントと接続したポイントを選択 → タイプ欄に入退出点の通知が表示される
    graph: { nodes: BOUNDARY_NODES, edges: BOUNDARY_EDGES },
    selectedNode: boundaryFixtureNode("gate"),
  },
};

export const ExternalClosed: Story = {
  args: {
    graph: { nodes: BOUNDARY_NODES, edges: [] },
    selectedNode: boundaryFixtureNode("external", []),
  },
};

export const ExternalDeletable: Story = {
  args: {
    graph: {
      nodes: [
        ...BOUNDARY_NODES,
        { ...boundaryFixtureNode("external"), id: "external-2" },
      ],
      edges: BOUNDARY_EDGES,
    },
    selectedNode: boundaryFixtureNode("external"),
  },
};

const selectionGraph = (nodeIds: string[], edgeIds: string[]) => ({
  nodes: GRAPH_NODES.map((node) => ({
    ...node,
    selected: nodeIds.includes(node.id),
  })),
  edges: GRAPH_EDGES.map((edge) => ({
    ...edge,
    selected: edgeIds.includes(edge.id),
  })),
});

export const MultipleSelection: Story = {
  args: {
    graph: selectionGraph(["ph_booth", "ph_wall", "ph_floor1"], ["ph_e2"]),
    selectionCounts: { nodes: 2, edges: 1, groups: 1 },
    canDeleteSelected: true,
    groupSelectionError: "pointsOnly",
  },
};

export const GroupableSelection: Story = {
  args: {
    graph: selectionGraph(["ph_booth", "ph_wall"], ["ph_e2"]),
    selectionCounts: { nodes: 2, edges: 1, groups: 0 },
    canDeleteSelected: true,
    groupSelectionError: null,
  },
};
export const DifferentParents: Story = {
  args: {
    graph: selectionGraph(["ph_booth", "ph_gallery2f"], []),
    selectionCounts: { nodes: 2, edges: 0, groups: 0 },
    canDeleteSelected: true,
    groupSelectionError: "differentParents",
  },
};

export const MixedProperties: Story = {
  args: {
    graph: {
      nodes: GRAPH_NODES.map((node) =>
        node.id === "ph_booth" || node.id === "ph_wall"
          ? { ...node, selected: true }
          : node,
      ),
      edges: GRAPH_EDGES.map((edge) =>
        edge.id === "ph_e1" || edge.id === "ph_e2"
          ? { ...edge, selected: true }
          : edge,
      ),
    },
    selectionCounts: { nodes: 2, edges: 2, groups: 0 },
    canDeleteSelected: true,
    groupSelectionError: null,
  },
};
export const PartialPropertyUpdate: Story = {
  args: {
    ...MixedProperties.args,
    graph: {
      ...selectionGraph(["ph_booth", "ph_wall"], ["ph_e1", "ph_e2"]),
      nodes: selectionGraph(["ph_booth", "ph_wall"], []).nodes.map((node) =>
        node.id === "ph_wall"
          ? {
              ...graphNode("ph_wall"),
              selected: true,
              data: { ...graphNode("ph_wall").data, nodeType: "TRANSIT_ONLY" },
            }
          : node,
      ),
    },
    bulkResult: {
      targetCount: 2,
      changedCount: 1,
      skippedCount: 1,
      reasons: [{ kind: "operation", messageKey: "requiresDwell", count: 1 }],
    },
  },
};
