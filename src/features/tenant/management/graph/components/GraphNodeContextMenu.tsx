import { Route, Trash2 } from "lucide-react";
import {
  Menu,
  MenuHeader,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/menu";
import { getNodeTypeDef } from "../nodeTypes";
import type { GraphEdgeType, GraphNodeType, NodeType } from "../type";
import {
  ContextMenuPopover,
  type ContextMenuPosition,
} from "./ContextMenuPopover";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { buildNodeTypeOptions } from "./properties/nodeTypeOptions";

export type GraphNodeContextMenuProps = {
  node: GraphNodeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  position: ContextMenuPosition;
  onSetType: (id: string, type: NodeType) => void;
  onStartEdgeCreation: (sourceNodeId: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/** ノードタイプを切り替える右クリックメニュー。 */
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
  const options = buildNodeTypeOptions(
    node.id,
    node.data.nodeType,
    nodes,
    edges,
  );

  return (
    <ContextMenuPopover
      position={position}
      className="min-w-48"
      onClose={onClose}
    >
      <Menu aria-label="ポイントのタイプを変更">
        <MenuItem
          id="add-edge"
          textValue="このポイントからルートを追加"
          onAction={() => {
            onStartEdgeCreation(node.id);
            onClose();
          }}
        >
          <Route aria-hidden className="size-4 shrink-0" />
          このポイントからルートを追加
        </MenuItem>
        <MenuSeparator />
        <MenuHeader className="px-2 text-xs">タイプを変更</MenuHeader>
        {options.map((option) => {
          const def = getNodeTypeDef(option.type);
          return (
            <MenuItem
              id={option.type}
              key={option.type}
              textValue={def.label}
              isDisabled={!option.assignable}
              onAction={() => {
                if (option.type !== node.data.nodeType) {
                  onSetType(node.id, option.type);
                }
                onClose();
              }}
            >
              <NodeTypeIcon type={option.type} />
              {def.label}
              {option.type === node.data.nodeType ? "（現在）" : null}
            </MenuItem>
          );
        })}
        <MenuSeparator />
        <MenuItem
          id="delete"
          textValue="このポイントを削除"
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onAction={() => {
            onDelete(node.id);
            onClose();
          }}
        >
          <Trash2 aria-hidden className="size-4 shrink-0" />
          このポイントを削除
        </MenuItem>
      </Menu>
    </ContextMenuPopover>
  );
}
