import type { XYPosition } from "@xyflow/react";
import { useRef } from "react";
import { Menu, MenuItem, MenuPopover } from "@/components/ui/menu";
import type { NodeType } from "../type";

type ContextMenuPosition = { x: number; y: number };

export type GraphCanvasContextMenuProps = {
  position: ContextMenuPosition;
  nodePosition: XYPosition;
  nodeType: NodeType;
  onAddNode: (position: XYPosition, nodeType: NodeType) => void;
  isEdgeCreationActive: boolean;
  onStartEdgeCreation: () => void;
  onEndEdgeCreation: () => void;
  onClose: () => void;
};

/** 背景上の右クリックからポイントを追加するグローバルメニュー。 */
export function GraphCanvasContextMenu({
  position,
  nodePosition,
  nodeType,
  onAddNode,
  isEdgeCreationActive,
  onStartEdgeCreation,
  onEndEdgeCreation,
  onClose,
}: GraphCanvasContextMenuProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);

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
        className="min-w-40"
      >
        <Menu aria-label="グラフ操作">
          {isEdgeCreationActive ? (
            <MenuItem
              id="end-edge-creation"
              onAction={() => {
                onEndEdgeCreation();
                onClose();
              }}
            >
              ルート追加を終了
            </MenuItem>
          ) : (
            <>
              <MenuItem
                id="add-node"
                onAction={() => {
                  onAddNode(nodePosition, nodeType);
                  onClose();
                }}
              >
                ポイントを追加
              </MenuItem>
              <MenuItem
                id="add-edge"
                onAction={() => {
                  onStartEdgeCreation();
                  onClose();
                }}
              >
                ルートを追加
              </MenuItem>
            </>
          )}
        </Menu>
      </MenuPopover>
    </>
  );
}
