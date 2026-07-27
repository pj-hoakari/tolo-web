import { Button } from "@/components/ui/button";
import type {
  GraphData,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
  GraphNodeType,
} from "../../type";
import { EdgeProperties } from "./EdgeProperties";
import { resolveEdgeDirectionState } from "./edgeDirectionState";
import { NodeProperties } from "./NodeProperties";
import { buildNodeTypeOptions } from "./nodeTypeOptions";
import type { ObservationPointsSource } from "./ObservationPointPicker";

export type PropertiesPanelProps = {
  selectedNode: GraphNodeType | undefined;
  selectedEdge: GraphEdgeType | undefined;
  /** 制約の検証と端点ラベルの解決に使うグラフ全体 */
  graph: GraphData;
  /** 紐づけ候補となる観測点（接続中のエッジ）一式 */
  observationPoints: ObservationPointsSource;
  onUpdateNode: (id: string, patch: Partial<GraphNodeData>) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdgeData>) => void;
  onReverseEdge: (id: string) => void;
  onDelete: () => void;
};

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  graph,
  observationPoints,
  onUpdateNode,
  onUpdateEdge,
  onReverseEdge,
  onDelete,
}: PropertiesPanelProps) {
  const { nodes, edges } = graph;
  const hasSelection = Boolean(selectedNode || selectedEdge);
  return (
    <aside className="flex w-72 shrink-0 flex-col border-border border-l bg-card">
      <div className="border-border border-b px-4 py-2">
        <p className="font-semibold text-foreground text-sm">プロパティ</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <NodeProperties
            node={selectedNode}
            typeOptions={buildNodeTypeOptions(
              selectedNode.id,
              selectedNode.data.nodeType,
              nodes,
              edges,
            )}
            observationPoints={observationPoints}
            onChange={(patch) => onUpdateNode(selectedNode.id, patch)}
          />
        ) : selectedEdge ? (
          <EdgeProperties
            edge={selectedEdge}
            directionState={resolveEdgeDirectionState(
              selectedEdge,
              nodes,
              edges,
            )}
            endpoints={{
              sourceLabel:
                nodes.find((n) => n.id === selectedEdge.source)?.data.label ??
                selectedEdge.source,
              targetLabel:
                nodes.find((n) => n.id === selectedEdge.target)?.data.label ??
                selectedEdge.target,
            }}
            observationPoints={observationPoints}
            onChange={(patch) => onUpdateEdge(selectedEdge.id, patch)}
            onReverse={() => onReverseEdge(selectedEdge.id)}
          />
        ) : (
          <p className="text-muted-foreground text-xs">
            ポイントまたはルートを選択してください。
          </p>
        )}
      </div>
      {hasSelection ? (
        <div className="border-border border-t p-3">
          <Button
            variant="destructive"
            size="sm"
            onPress={onDelete}
            className="w-full"
          >
            {selectedNode ? "このポイントを削除" : "このルートを削除"}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
