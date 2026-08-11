import { useTranslations } from "next-intl";
import { Menu } from "@/components/ui/menu";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";
import {
  GraphCreationMenuItems,
  type GraphCreationMenuItemsProps,
} from "./GraphCreationMenuItems";

export type GraphCanvasContextMenuProps = GraphCreationMenuItemsProps & {
  position: ContextMenuPosition;
  onClose: () => void;
};

/** 背景上の右クリックからポイントを追加するグローバルメニュー。 */
export function GraphCanvasContextMenu({
  position,
  onClose,
  ...creationProps
}: GraphCanvasContextMenuProps) {
  const t = useTranslations("Graph.contextMenu");

  return (
    <ContextMenuPopover
      position={position}
      className="min-w-40"
      onClose={onClose}
    >
      <Menu aria-label={t("canvasLabel")}>
        <GraphCreationMenuItems {...creationProps} />
      </Menu>
    </ContextMenuPopover>
  );
}
