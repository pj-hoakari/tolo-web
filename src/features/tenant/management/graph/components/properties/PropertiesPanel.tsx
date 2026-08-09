import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type {
  GraphCanvasNode,
  GraphData,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
} from "../../type";
import { isGroupNode } from "../../type";
import { EdgeProperties } from "./EdgeProperties";
import { resolveEdgeDirectionState } from "./edgeDirectionState";
import { GroupProperties } from "./GroupProperties";
import { NodeProperties } from "./NodeProperties";
import { buildNodeTypeOptions } from "./nodeTypeOptions";

export type PropertiesPanelProps = {
  selectedNode: GraphCanvasNode | undefined;
  selectedEdge: GraphEdgeType | undefined;
  /** 制約の検証と端点ラベルの解決に使うグラフ全体 */
  graph: GraphData;
  onUpdateNode: (id: string, patch: Partial<GraphNodeData>) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdgeData>) => void;
  onReverseEdge: (id: string) => void;
  onDelete: () => void;
};

/** グラフ構造（ポイント・ルート）を編集するプロパティパネル */
export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  graph,
  onUpdateNode,
  onUpdateEdge,
  onReverseEdge,
  onDelete,
}: PropertiesPanelProps) {
  const { nodes, edges } = graph;
  const hasSelection = Boolean(selectedNode || selectedEdge);
  const t = useTranslations("Graph.properties");
  const tNotice = useTranslations("Graph.notices");

  return (
    <aside className="flex w-72 shrink-0 flex-col border-border border-l bg-card">
      <div className="border-border border-b px-4 py-2">
        <p className="font-semibold text-foreground text-sm">{t("title")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedNode && isGroupNode(selectedNode) ? (
          <GroupProperties
            group={selectedNode}
            onChange={(patch) => onUpdateNode(selectedNode.id, patch)}
          />
        ) : selectedNode ? (
          <NodeProperties
            node={selectedNode}
            typeOptions={buildNodeTypeOptions(
              selectedNode.id,
              selectedNode.data.nodeType,
              nodes,
              edges,
              tNotice,
            )}
            onChange={(patch) => onUpdateNode(selectedNode.id, patch)}
          />
        ) : selectedEdge ? (
          <EdgeProperties
            edge={selectedEdge}
            directionState={resolveEdgeDirectionState(
              selectedEdge,
              nodes,
              edges,
              tNotice,
            )}
            endpoints={{
              sourceLabel:
                nodes.find((n) => n.id === selectedEdge.source)?.data.label ??
                selectedEdge.source,
              targetLabel:
                nodes.find((n) => n.id === selectedEdge.target)?.data.label ??
                selectedEdge.target,
            }}
            onChange={(patch) => onUpdateEdge(selectedEdge.id, patch)}
            onReverse={() => onReverseEdge(selectedEdge.id)}
          />
        ) : (
          <p className="text-muted-foreground text-xs">{t("empty")}</p>
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
            {selectedNode
              ? isGroupNode(selectedNode)
                ? t("dissolveGroup")
                : t("deleteNode")
              : t("deleteEdge")}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
