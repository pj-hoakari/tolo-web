import { Route, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Text } from "react-aria-components";
import {
  Menu,
  MenuHeader,
  MenuItem,
  MenuSection,
  MenuSeparator,
} from "@/components/ui/menu";
import type {
  GraphCanvasNode,
  GraphEdgeType,
  GraphNodeType,
  NodeType,
} from "../type";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { buildNodeTypeOptions } from "./properties/nodeTypeOptions";

export type GraphNodeContextMenuProps = {
  node: GraphNodeType;
  nodes: GraphCanvasNode[];
  edges: GraphEdgeType[];
  position: ContextMenuPosition;
  onSetType: (id: string, type: NodeType) => void;
  onStartEdgeCreation: (sourceNodeId: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/** ポイントの右クリックメニュー（ルート追加・タイプ変更・削除）。 */
export function GraphNodeContextMenu({
  node,
  nodes,
  edges,
  position,
  onSetType,
  onStartEdgeCreation,
  onDelete,
  onClose,
}: GraphNodeContextMenuProps) {
  const t = useTranslations("Graph.contextMenu");
  const tType = useTranslations("Graph.nodeType");
  const tNotice = useTranslations("Graph.notices");

  const options = buildNodeTypeOptions(
    node.id,
    node.data.nodeType,
    nodes,
    edges,
    tNotice,
  );

  return (
    <ContextMenuPopover
      position={position}
      className="min-w-48"
      onClose={onClose}
    >
      <Menu aria-label={t("nodeLabel", { label: node.data.label })}>
        <MenuItem
          id="add-edge"
          textValue={t("addEdgeFromNode")}
          onAction={() => {
            onStartEdgeCreation(node.id);
            onClose();
          }}
        >
          <Route aria-hidden className="size-4 shrink-0" />
          {t("addEdgeFromNode")}
        </MenuItem>
        <MenuSeparator />
        {/* 選択中のタイプをラジオ選択として支援技術へ伝える */}
        <MenuSection selectionMode="single" selectedKeys={[node.data.nodeType]}>
          <MenuHeader className="px-2 text-xs">{t("changeType")}</MenuHeader>
          {options.map((option) => {
            const typeLabel = tType(option.type);
            return (
              <MenuItem
                id={option.type}
                key={option.type}
                textValue={typeLabel}
                isDisabled={!option.assignable}
                onAction={() => {
                  if (option.type !== node.data.nodeType) {
                    onSetType(node.id, option.type);
                  }
                  onClose();
                }}
              >
                <NodeTypeIcon type={option.type} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text slot="label">{typeLabel}</Text>
                  {option.disabledReason ? (
                    <Text
                      slot="description"
                      className="text-muted-foreground text-xs"
                    >
                      {option.disabledReason}
                    </Text>
                  ) : null}
                </div>
              </MenuItem>
            );
          })}
        </MenuSection>
        <MenuSeparator />
        <MenuItem
          id="delete"
          textValue={t("deleteNode")}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onAction={() => {
            onDelete(node.id);
            onClose();
          }}
        >
          <Trash2 aria-hidden className="size-4 shrink-0" />
          {t("deleteNode")}
        </MenuItem>
      </Menu>
    </ContextMenuPopover>
  );
}
