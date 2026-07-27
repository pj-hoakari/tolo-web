import { Button } from "@/components/ui/button";
import type { AliveEdgesStatus } from "@/features/tenant/webrtc/hooks/useAliveEdges";
import type { AliveEdge } from "@/features/tenant/webrtc/type";
import type {
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
  GraphNodeType,
} from "../../type";
import { EdgeProperties } from "./EdgeProperties";
import { NodeProperties } from "./NodeProperties";

type Props = {
  selectedNode: GraphNodeType | undefined;
  selectedEdge: GraphEdgeType | undefined;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  /** 紐づけ候補となる観測点（接続中のエッジ）一覧 */
  observationPoints: AliveEdge[];
  observationPointsStatus?: AliveEdgesStatus;
  /** いずれかのノード/ルートで使用中（＝他では選択不可）の観測点 ID 集合 */
  usedObservationPointIds: ReadonlySet<string>;
  onRefreshObservationPoints?: () => void;
  onUpdateNode: (id: string, patch: Partial<GraphNodeData>) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdgeData>) => void;
  onReverseEdge: (id: string) => void;
  /** 観測点のリンク操作（対象の紐づけを ids に更新する） */
  onLinkObservationPoints: (
    target: { type: "node" | "edge"; id: string },
    ids: string[],
  ) => void;
  onDelete: () => void;
};

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  nodes,
  edges,
  observationPoints,
  observationPointsStatus,
  usedObservationPointIds,
  onRefreshObservationPoints,
  onUpdateNode,
  onUpdateEdge,
  onReverseEdge,
  onLinkObservationPoints,
  onDelete,
}: Props) {
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
            nodes={nodes}
            edges={edges}
            observationPoints={observationPoints}
            observationPointsStatus={observationPointsStatus}
            usedObservationPointIds={usedObservationPointIds}
            onRefreshObservationPoints={onRefreshObservationPoints}
            onChange={(patch) => onUpdateNode(selectedNode.id, patch)}
            onChangeObservationPoints={(ids) =>
              onLinkObservationPoints(
                { type: "node", id: selectedNode.id },
                ids,
              )
            }
          />
        ) : selectedEdge ? (
          <EdgeProperties
            edge={selectedEdge}
            nodes={nodes}
            edges={edges}
            observationPoints={observationPoints}
            observationPointsStatus={observationPointsStatus}
            usedObservationPointIds={usedObservationPointIds}
            onRefreshObservationPoints={onRefreshObservationPoints}
            onChangeObservationPoints={(ids) =>
              onLinkObservationPoints(
                { type: "edge", id: selectedEdge.id },
                ids,
              )
            }
            sourceLabel={
              nodes.find((n) => n.id === selectedEdge.source)?.data.label ??
              selectedEdge.source
            }
            targetLabel={
              nodes.find((n) => n.id === selectedEdge.target)?.data.label ??
              selectedEdge.target
            }
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
