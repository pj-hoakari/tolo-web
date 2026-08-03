import type { XYPosition } from "@xyflow/react";
import { Menu, MenuItem } from "@/components/ui/menu";
import type { NodeType } from "../type";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";

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
  return (
    <ContextMenuPopover
      position={position}
      className="min-w-40"
      onClose={onClose}
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
    </ContextMenuPopover>
  );
}
