import { useRef } from "react";
import { Menu, MenuItem, MenuPopover } from "@/components/ui/menu";
import type { EdgeDirection, GraphEdgeType, GraphNodeType } from "../type";
import { resolveEdgeDirectionState } from "./properties/edgeDirectionState";

type ContextMenuPosition = { x: number; y: number };

export type GraphEdgeContextMenuProps = {
  edge: GraphEdgeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  position: ContextMenuPosition;
  onSetDirection: (id: string, direction: EdgeDirection) => void;
  onReverse: (id: string) => void;
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
  onClose,
}: GraphEdgeContextMenuProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const direction = edge.data?.direction ?? "both";
  const directionState = resolveEdgeDirectionState(edge, nodes, edges);
  const sourceLabel =
    nodes.find((node) => node.id === edge.source)?.data.label ?? edge.source;
  const targetLabel =
    nodes.find((node) => node.id === edge.target)?.data.label ?? edge.target;

  return (
    <>
      {/* React Aria Popover の位置決め専用アンカー */}
      <span
        ref={anchorRef}
        aria-hidden="true"
        className="pointer-events-none fixed size-px"
        style={{ left: position.x, top: position.y }}
      />
      <MenuPopover
        isOpen
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
        triggerRef={anchorRef}
        placement="bottom start"
        offset={0}
        className="min-w-56"
      >
        <Menu aria-label="ルートの方向を変更">
          {direction === "both" ? (
            <MenuItem
              id="oneway"
              isDisabled={directionState.onewayDisabled}
              onAction={() => {
                onSetDirection(edge.id, "oneway");
                onClose();
              }}
            >
              片側通行にする（{sourceLabel} → {targetLabel}）
            </MenuItem>
          ) : (
            <>
              <MenuItem
                id="both"
                isDisabled={directionState.bothDisabled}
                onAction={() => {
                  onSetDirection(edge.id, "both");
                  onClose();
                }}
              >
                両方向通行にする
              </MenuItem>
              <MenuItem
                id="reverse"
                isDisabled={directionState.reverseDisabled}
                onAction={() => {
                  onReverse(edge.id);
                  onClose();
                }}
              >
                向きを反転（{targetLabel} → {sourceLabel}）
              </MenuItem>
            </>
          )}
        </Menu>
      </MenuPopover>
    </>
  );
}
