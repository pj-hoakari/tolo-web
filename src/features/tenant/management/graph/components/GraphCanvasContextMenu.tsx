import type { XYPosition } from "@xyflow/react";
import { MapPinPlus, Route, X } from "lucide-react";
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
      <Menu aria-label="キャンバスの操作">
        {isEdgeCreationActive ? (
          <MenuItem
            id="end-edge-creation"
            textValue="ルート追加を終了"
            onAction={() => {
              onEndEdgeCreation();
              onClose();
            }}
          >
            <X aria-hidden className="size-4 shrink-0" />
            ルート追加を終了
          </MenuItem>
        ) : (
          <>
            <MenuItem
              id="add-node"
              textValue="ポイントを追加"
              onAction={() => {
                onAddNode(nodePosition, nodeType);
                onClose();
              }}
            >
              <MapPinPlus aria-hidden className="size-4 shrink-0" />
              ポイントを追加
            </MenuItem>
            <MenuItem
              id="add-edge"
              textValue="ルートを追加"
              onAction={() => {
                onStartEdgeCreation();
                onClose();
              }}
            >
              <Route aria-hidden className="size-4 shrink-0" />
              ルートを追加
            </MenuItem>
          </>
        )}
      </Menu>
    </ContextMenuPopover>
  );
}
