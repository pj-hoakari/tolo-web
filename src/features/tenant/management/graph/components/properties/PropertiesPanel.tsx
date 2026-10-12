import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/locale";
import type {
  GraphCanvasNode,
  GraphData,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
} from "../../type";
import { isExternalNode, isGroupNode } from "../../type";
import { isLastExternal } from "../../utils/graphMutations";
import type { getGroupSelectionError } from "../../utils/selectionActions";
import { BulkProperties, type BulkPropertiesBindings } from "./BulkProperties";
import { EdgeProperties } from "./EdgeProperties";
import { ExternalProperties } from "./ExternalProperties";
import { resolveEdgeDirectionState } from "./edgeDirectionState";
import { GroupProperties } from "./GroupProperties";
import { NodeProperties } from "./NodeProperties";
import { buildNodeTypeOptions } from "./nodeTypeOptions";

export type PropertiesPanelProps = BulkPropertiesBindings & {
  selectedNode: GraphCanvasNode | undefined;
  selectedEdge: GraphEdgeType | undefined;
  selectionCounts?: { nodes: number; edges: number; groups: number };
  /** 制約の検証と端点ラベルの解決に使うグラフ全体 */
  graph: GraphData;
  /** ポイントラベルの編集言語 */
  labelLocale: Locale;
  onUpdateNode: (id: string, patch: Partial<GraphNodeData>) => void;
  /** 編集言語のポイントラベルを更新する */
  onSetNodeLabel: (id: string, label: string) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdgeData>) => void;
  onReverseEdge: (id: string) => void;
  onDelete: () => void;
  onDeleteSelected: () => void;
  canDeleteSelected: boolean;
  onGroupSelected: () => void;
  groupSelectionError: ReturnType<typeof getGroupSelectionError>;
};

/** グラフ構造（ポイント・ルート）を編集するプロパティパネル */
export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  selectionCounts,
  graph,
  labelLocale,
  onUpdateNode,
  onSetNodeLabel,
  onUpdateEdge,
  onReverseEdge,
  onDelete,
  onDeleteSelected,
  canDeleteSelected,
  onGroupSelected,
  groupSelectionError,
  onSetSelectedNodeFlag,
  onSetSelectedEdgeDirection,
  onReverseSelectedEdges,
  bulkResult,
}: PropertiesPanelProps) {
  const { nodes, edges } = graph;
  const groupReasonId = useId();
  const multiple =
    selectionCounts !== undefined &&
    selectionCounts.nodes + selectionCounts.edges + selectionCounts.groups > 1;
  const deletable =
    !multiple &&
    (selectedNode
      ? !isLastExternal(selectedNode.id, nodes)
      : Boolean(selectedEdge));
  const t = useTranslations("Graph.properties");
  const tNotice = useTranslations("Graph.notices");

  return (
    <aside className="flex w-72 shrink-0 flex-col border-border border-l bg-card">
      <div className="border-border border-b px-4 py-2">
        <p className="font-semibold text-foreground text-sm">{t("title")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {multiple && selectionCounts ? (
          <div className="space-y-3">
            <div className="space-y-2 text-muted-foreground text-sm">
              <p>{t("selectedNodes", { count: selectionCounts.nodes })}</p>
              <p>{t("selectedEdges", { count: selectionCounts.edges })}</p>
              <p>{t("selectedGroups", { count: selectionCounts.groups })}</p>
            </div>
            <BulkProperties
              graph={graph}
              onSetSelectedNodeFlag={onSetSelectedNodeFlag}
              onSetSelectedEdgeDirection={onSetSelectedEdgeDirection}
              onReverseSelectedEdges={onReverseSelectedEdges}
              bulkResult={bulkResult}
            />
          </div>
        ) : selectedNode && isGroupNode(selectedNode) ? (
          <GroupProperties
            group={selectedNode}
            labelLocale={labelLocale}
            onChangeLabel={(label) => onSetNodeLabel(selectedNode.id, label)}
          />
        ) : selectedNode && isExternalNode(selectedNode) ? (
          <ExternalProperties node={selectedNode} />
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
            labelLocale={labelLocale}
            onChange={(patch) => onUpdateNode(selectedNode.id, patch)}
            onChangeLabel={(label) => onSetNodeLabel(selectedNode.id, label)}
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
      {multiple ? (
        <div className="space-y-2 border-border border-t p-3">
          <Button
            key="group"
            size="sm"
            variant="outline"
            className="w-full"
            onPress={onGroupSelected}
            aria-describedby={
              groupSelectionError !== null ? groupReasonId : undefined
            }
            isDisabled={groupSelectionError !== null}
          >
            {t("groupSelected")}
          </Button>
          {groupSelectionError !== null ? (
            <p id={groupReasonId} className="text-muted-foreground text-xs">
              {t(`groupSelectionErrors.${groupSelectionError}`)}
            </p>
          ) : null}
          <Button
            key="delete"
            size="sm"
            variant="destructive"
            className="w-full"
            onPress={onDeleteSelected}
            isDisabled={!canDeleteSelected}
          >
            {t("deleteSelected")}
          </Button>
          {selectionCounts && selectionCounts.groups > 0 ? (
            <p className="text-muted-foreground text-xs">
              {t("deleteSelectedGroupHint")}
            </p>
          ) : null}
        </div>
      ) : deletable ? (
        <div className="border-border border-t p-3">
          <Button
            key="delete"
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
