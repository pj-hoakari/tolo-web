import { Route, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Menu,
  MenuHeader,
  MenuSection,
  MenuSeparator,
} from "@/components/ui/menu";
import type {
  GraphCanvasNode,
  GraphEdgeType,
  GraphNodeType,
  NodeType,
} from "../type";
import { ContextMenuItem } from "./ContextMenuItem";
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
        <ContextMenuItem
          id="add-edge"
          icon={Route}
          label={t("addEdgeFromNode")}
          onAction={() => onStartEdgeCreation(node.id)}
        />
        <MenuSeparator />
        {/* 選択中のタイプをラジオ選択として支援技術へ伝える */}
        <MenuSection selectionMode="single" selectedKeys={[node.data.nodeType]}>
          <MenuHeader className="px-2 text-xs">{t("changeType")}</MenuHeader>
          {options.map((option) => (
            <ContextMenuItem
              id={option.type}
              key={option.type}
              icon={<NodeTypeIcon type={option.type} />}
              label={tType(option.type)}
              description={option.disabledReason}
              isDisabled={!option.assignable}
              onAction={() => {
                if (option.type !== node.data.nodeType) {
                  onSetType(node.id, option.type);
                }
              }}
            />
          ))}
        </MenuSection>
        <MenuSeparator />
        <ContextMenuItem
          id="delete"
          icon={Trash2}
          label={t("deleteNode")}
          variant="destructive"
          onAction={() => onDelete(node.id)}
        />
      </Menu>
    </ContextMenuPopover>
  );
}
