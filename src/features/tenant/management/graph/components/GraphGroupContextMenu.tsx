import type { XYPosition } from "@xyflow/react";
import { Ungroup } from "lucide-react";
import { useTranslations } from "next-intl";
import { Menu, MenuSeparator } from "@/components/ui/menu";
import type { GroupNodeType, NodeType } from "../type";
import { ContextMenuItem } from "./ContextMenuItem";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";
import {
  GraphCreationMenuItems,
  type GraphCreationMenuItemsProps,
} from "./GraphCreationMenuItems";

export type GraphGroupContextMenuProps = Omit<
  GraphCreationMenuItemsProps,
  "onAddNode" | "onAddGroup"
> & {
  group: GroupNodeType;
  position: ContextMenuPosition;
  /** グループ内へポイントを追加する */
  onAddNode: (
    position: XYPosition,
    nodeType: NodeType,
    parentId: string,
  ) => void;
  /** グループ内へネストしたグループを追加する */
  onAddGroup: (position: XYPosition, parentId: string) => void;
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
  onAddNode,
  onAddGroup,
  onDissolve,
  onClose,
  ...creationProps
}: GraphGroupContextMenuProps) {
  const t = useTranslations("Graph.contextMenu");

  return (
    <ContextMenuPopover
      position={position}
      className="min-w-48"
      onClose={onClose}
    >
      <Menu
        aria-label={t("groupLabel", { label: group.data.label ?? group.id })}
      >
        <GraphCreationMenuItems
          {...creationProps}
          // 追加操作はこのグループを親にする
          onAddNode={(nodePosition, nodeType) =>
            onAddNode(nodePosition, nodeType, group.id)
          }
          onAddGroup={(nodePosition) => onAddGroup(nodePosition, group.id)}
        />
        <MenuSeparator />
        <ContextMenuItem
          id="dissolve"
          icon={Ungroup}
          label={t("dissolveGroup")}
          variant="destructive"
          onAction={() => onDissolve(group.id)}
        />
      </Menu>
    </ContextMenuPopover>
  );
}
