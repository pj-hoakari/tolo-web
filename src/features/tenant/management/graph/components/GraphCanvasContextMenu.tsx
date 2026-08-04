import type { XYPosition } from "@xyflow/react";
import { MapPinPlus, Route, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Graph.contextMenu");

  return (
    <ContextMenuPopover
      position={position}
      className="min-w-40"
      onClose={onClose}
    >
      <Menu aria-label={t("canvasLabel")}>
        {isEdgeCreationActive ? (
          <MenuItem
            id="end-edge-creation"
            textValue={t("endEdgeCreation")}
            onAction={() => {
              onEndEdgeCreation();
              onClose();
            }}
          >
            <X aria-hidden className="size-4 shrink-0" />
            {t("endEdgeCreation")}
          </MenuItem>
        ) : (
          <>
            <MenuItem
              id="add-node"
              textValue={t("addNode")}
              onAction={() => {
                onAddNode(nodePosition, nodeType);
                onClose();
              }}
            >
              <MapPinPlus aria-hidden className="size-4 shrink-0" />
              {t("addNode")}
            </MenuItem>
            <MenuItem
              id="add-edge"
              textValue={t("addEdge")}
              onAction={() => {
                onStartEdgeCreation();
                onClose();
              }}
            >
              <Route aria-hidden className="size-4 shrink-0" />
              {t("addEdge")}
            </MenuItem>
          </>
        )}
      </Menu>
    </ContextMenuPopover>
  );
}
