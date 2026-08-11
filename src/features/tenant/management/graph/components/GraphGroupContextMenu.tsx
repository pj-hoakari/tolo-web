import type { XYPosition } from "@xyflow/react";
import { MapPinPlus, Route, SquareDashed, Ungroup, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import type { GroupNodeType, NodeType } from "../type";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";

export type GraphGroupContextMenuProps = {
  group: GroupNodeType;
  position: ContextMenuPosition;
  /** 追加する要素を置くフロー座標（右クリック位置） */
  nodePosition: XYPosition;
  nodeType: NodeType;
  /** グループ内へポイントを追加する */
  onAddNode: (
    position: XYPosition,
    nodeType: NodeType,
    parentId: string,
  ) => void;
  /** グループ内へネストしたグループを追加する */
  onAddGroup: (position: XYPosition, parentId: string) => void;
  isEdgeCreationActive: boolean;
  onStartEdgeCreation: () => void;
  onEndEdgeCreation: () => void;
  /** グループを解除する（中身のノードは残す） */
  onDissolve: (id: string) => void;
  onClose: () => void;
};

/**
 * グループコンテナの右クリックメニュー。
 * グループの内側は背景ではなくグループノードへの右クリックになるため、
 * 背景メニューと同じ追加操作もここから行えるようにしている。
 */
export function GraphGroupContextMenu({
  group,
  position,
  nodePosition,
  nodeType,
  onAddNode,
  onAddGroup,
  isEdgeCreationActive,
  onStartEdgeCreation,
  onEndEdgeCreation,
  onDissolve,
  onClose,
}: GraphGroupContextMenuProps) {
  const t = useTranslations("Graph.contextMenu");

  return (
    <ContextMenuPopover
      position={position}
      className="min-w-48"
      onClose={onClose}
    >
      <Menu aria-label={t("groupLabel", { label: group.data.label })}>
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
                onAddNode(nodePosition, nodeType, group.id);
                onClose();
              }}
            >
              <MapPinPlus aria-hidden className="size-4 shrink-0" />
              {t("addNode")}
            </MenuItem>
            <MenuItem
              id="add-group"
              textValue={t("addGroup")}
              onAction={() => {
                onAddGroup(nodePosition, group.id);
                onClose();
              }}
            >
              <SquareDashed aria-hidden className="size-4 shrink-0" />
              {t("addGroup")}
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
        <MenuSeparator />
        <MenuItem
          id="dissolve"
          textValue={t("dissolveGroup")}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onAction={() => {
            onDissolve(group.id);
            onClose();
          }}
        >
          <Ungroup aria-hidden className="size-4 shrink-0" />
          {t("dissolveGroup")}
        </MenuItem>
      </Menu>
    </ContextMenuPopover>
  );
}
