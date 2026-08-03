import { ArrowLeftRight, ArrowRight, Repeat2, Trash2 } from "lucide-react";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import type { EdgeDirection, GraphEdgeType, GraphNodeType } from "../type";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";
import { resolveEdgeDirectionState } from "./properties/edgeDirectionState";

export type GraphEdgeContextMenuProps = {
  edge: GraphEdgeType;
  nodes: GraphNodeType[];
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
  const direction = edge.data?.direction ?? "both";
  const directionState = resolveEdgeDirectionState(edge, nodes, edges);
  const sourceLabel =
    nodes.find((node) => node.id === edge.source)?.data.label ?? edge.source;
  const targetLabel =
    nodes.find((node) => node.id === edge.target)?.data.label ?? edge.target;

  return (
    <ContextMenuPopover
      position={position}
      className="min-w-56"
      onClose={onClose}
    >
      <Menu aria-label="ルートの方向を変更">
        {direction === "both" ? (
          <MenuItem
            id="oneway"
            textValue={`片側通行にする（${sourceLabel} → ${targetLabel}）`}
            isDisabled={directionState.onewayDisabled}
            onAction={() => {
              onSetDirection(edge.id, "oneway");
              onClose();
            }}
          >
            <ArrowRight aria-hidden className="size-4 shrink-0" />
            片側通行にする（{sourceLabel} → {targetLabel}）
          </MenuItem>
        ) : (
          <>
            <MenuItem
              id="both"
              textValue="両方向通行にする"
              isDisabled={directionState.bothDisabled}
              onAction={() => {
                onSetDirection(edge.id, "both");
                onClose();
              }}
            >
              <ArrowLeftRight aria-hidden className="size-4 shrink-0" />
              両方向通行にする
            </MenuItem>
            <MenuItem
              id="reverse"
              textValue={`向きを反転（${targetLabel} → ${sourceLabel}）`}
              isDisabled={directionState.reverseDisabled}
              onAction={() => {
                onReverse(edge.id);
                onClose();
              }}
            >
              <Repeat2 aria-hidden className="size-4 shrink-0" />
              向きを反転（{targetLabel} → {sourceLabel}）
            </MenuItem>
          </>
        )}
        <MenuSeparator />
        <MenuItem
          id="delete"
          textValue="このルートを削除"
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onAction={() => {
            onDelete(edge.id);
            onClose();
          }}
        >
          <Trash2 aria-hidden className="size-4 shrink-0" />
          このルートを削除
        </MenuItem>
      </Menu>
    </ContextMenuPopover>
  );
}
