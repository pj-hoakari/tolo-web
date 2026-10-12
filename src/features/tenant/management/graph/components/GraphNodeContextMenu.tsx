import { Flag, Hourglass, Route, Trash2 } from "lucide-react";
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
import { isExternalNode } from "../type";
import { isLastExternal } from "../utils/graphMutations";
import { ContextMenuItem } from "./ContextMenuItem";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";
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
  const tFlag = useTranslations("Graph.nodeTypeFlag");
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
      <Menu aria-label={t("nodeLabel", { label: node.data.label ?? node.id })}>
        <ContextMenuItem
          id="add-edge"
          icon={Route}
          label={t("addEdgeFromNode")}
          onAction={() => onStartEdgeCreation(node.id)}
        />
        {isExternalNode(node) ? null : (
          <>
            <MenuSeparator />
            <MenuSection
              selectionMode="multiple"
              selectedKeys={options.filter((o) => o.checked).map((o) => o.flag)}
            >
              <MenuHeader className="px-2 text-xs">
                {t("changeType")}
              </MenuHeader>
              {options.map((option) => (
                <ContextMenuItem
                  id={option.flag}
                  key={option.flag}
                  icon={option.flag === "dwell" ? Hourglass : Flag}
                  label={tFlag(option.flag)}
                  description={option.disabledReason}
                  isDisabled={!option.assignable}
                  onAction={() => onSetType(node.id, option.next)}
                />
              ))}
            </MenuSection>
          </>
        )}
        {isLastExternal(node.id, nodes) ? null : (
          <>
            <MenuSeparator />
            <ContextMenuItem
              id="delete"
              icon={Trash2}
              label={t("deleteNode")}
              variant="destructive"
              onAction={() => onDelete(node.id)}
            />
          </>
        )}
      </Menu>
    </ContextMenuPopover>
  );
}
