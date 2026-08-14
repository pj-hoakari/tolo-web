import { ArrowLeftRight, ArrowRight, Repeat2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Menu, MenuSeparator } from "@/components/ui/menu";
import type { EdgeDirection, GraphCanvasNode, GraphEdgeType } from "../type";
import { ContextMenuItem } from "./ContextMenuItem";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";
import { resolveEdgeDirectionState } from "./properties/edgeDirectionState";

export type GraphEdgeContextMenuProps = {
  edge: GraphEdgeType;
  nodes: GraphCanvasNode[];
  edges: GraphEdgeType[];
  position: ContextMenuPosition;
  onSetDirection: (id: string, direction: EdgeDirection) => void;
  onReverse: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/** エッジの通行方向を切り替える右クリックメニュー。 */
export function GraphEdgeContextMenu({
  edge,
  nodes,
  edges,
  position,
  onSetDirection,
  onReverse,
  onDelete,
  onClose,
}: GraphEdgeContextMenuProps) {
  const t = useTranslations("Graph.contextMenu");
  const tNotice = useTranslations("Graph.notices");

  const direction = edge.data?.direction ?? "both";
  const directionState = resolveEdgeDirectionState(edge, nodes, edges, tNotice);
  const labelOf = (id: string) =>
    nodes.find((node) => node.id === id)?.data.label ?? id;
  const endpoints = {
    source: labelOf(edge.source),
    target: labelOf(edge.target),
  };

  return (
    <ContextMenuPopover
      position={position}
      className="min-w-56"
      onClose={onClose}
    >
      <Menu aria-label={t("edgeLabel", endpoints)}>
        {direction === "both" ? (
          <ContextMenuItem
            id="oneway"
            icon={ArrowRight}
            label={t("setOneway", endpoints)}
            description={
              directionState.onewayDisabled
                ? directionState.directionReason
                : null
            }
            isDisabled={directionState.onewayDisabled}
            onAction={() => onSetDirection(edge.id, "oneway")}
          />
        ) : (
          <>
            <ContextMenuItem
              id="both"
              icon={ArrowLeftRight}
              label={t("setBoth")}
              description={
                directionState.bothDisabled
                  ? directionState.directionReason
                  : null
              }
              isDisabled={directionState.bothDisabled}
              onAction={() => onSetDirection(edge.id, "both")}
            />
            <ContextMenuItem
              id="reverse"
              icon={Repeat2}
              label={t("reverse", endpoints)}
              description={
                directionState.reverseDisabled
                  ? directionState.reverseReason
                  : null
              }
              isDisabled={directionState.reverseDisabled}
              onAction={() => onReverse(edge.id)}
            />
          </>
        )}
        <MenuSeparator />
        <ContextMenuItem
          id="delete"
          icon={Trash2}
          label={t("deleteEdge")}
          variant="destructive"
          onAction={() => onDelete(edge.id)}
        />
      </Menu>
    </ContextMenuPopover>
  );
}
