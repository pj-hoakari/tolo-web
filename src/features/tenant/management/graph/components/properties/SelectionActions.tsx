import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { GraphCanvasNode } from "../../type";
import { isGroupNode } from "../../type";
import { isLastExternal } from "../../utils/graphMutations";
import type { getGroupSelectionError } from "../../utils/selectionActions";
import type { SelectionView } from "../sidePanel/sidePanelView";

export type SelectionActionsBindings = {
  onDelete: () => void;
  onDeleteSelected: () => void;
  canDeleteSelected: boolean;
  onGroupSelected: () => void;
  groupSelectionError: ReturnType<typeof getGroupSelectionError>;
};

export function SelectionActions({
  selection,
  nodes,
  onDelete,
  onDeleteSelected,
  canDeleteSelected,
  onGroupSelected,
  groupSelectionError,
}: SelectionActionsBindings & {
  selection: SelectionView;
  nodes: GraphCanvasNode[];
}) {
  const t = useTranslations("Graph.properties");
  const groupReasonId = useId();

  if (selection.kind === "bulk") {
    return (
      <div className="space-y-2 border-t border-border p-3">
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
          <p id={groupReasonId} className="text-xs text-muted-foreground">
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
        {selection.counts.groups > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("deleteSelectedGroupHint")}
          </p>
        ) : null}
      </div>
    );
  }

  if (selection.kind === "node" && isLastExternal(selection.node.id, nodes)) {
    return null;
  }

  return (
    <div className="border-t border-border p-3">
      <Button
        key="delete"
        variant="destructive"
        size="sm"
        onPress={onDelete}
        className="w-full"
      >
        {selection.kind === "edge"
          ? t("deleteEdge")
          : isGroupNode(selection.node)
            ? t("dissolveGroup")
            : t("deleteNode")}
      </Button>
    </div>
  );
}
