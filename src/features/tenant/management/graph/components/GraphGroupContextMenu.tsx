import { Ungroup } from "lucide-react";
import { useTranslations } from "next-intl";
import { Menu, MenuItem } from "@/components/ui/menu";
import type { GroupNodeType } from "../type";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";

export type GraphGroupContextMenuProps = {
  group: GroupNodeType;
  position: ContextMenuPosition;
  /** グループを解除する（中身のノードは残す） */
  onDissolve: (id: string) => void;
  onClose: () => void;
};

/** グループコンテナの右クリックメニュー。 */
export function GraphGroupContextMenu({
  group,
  position,
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
