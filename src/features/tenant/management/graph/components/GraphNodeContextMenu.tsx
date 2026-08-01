import { useRef } from "react";
import { Menu, MenuItem, MenuPopover } from "@/components/ui/menu";
import { getNodeTypeDef } from "../nodeTypes";
import type { GraphEdgeType, GraphNodeType, NodeType } from "../type";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { buildNodeTypeOptions } from "./properties/nodeTypeOptions";

type ContextMenuPosition = { x: number; y: number };

export type GraphNodeContextMenuProps = {
  node: GraphNodeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  position: ContextMenuPosition;
  onSetType: (id: string, type: NodeType) => void;
  onClose: () => void;
};

/** ノードタイプを切り替える右クリックメニュー。 */
export function GraphNodeContextMenu({
  node,
  nodes,
  edges,
  position,
  onSetType,
  onClose,
}: GraphNodeContextMenuProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const options = buildNodeTypeOptions(
    node.id,
    node.data.nodeType,
    nodes,
    edges,
  );

  return (
    <>
      {/* React Aria Popover の位置決め専用アンカー */}
      <span
        ref={anchorRef}
        aria-hidden="true"
        className="pointer-events-none fixed size-px"
        style={{ left: position.x, top: position.y }}
      />
      <MenuPopover
        isOpen
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
        triggerRef={anchorRef}
        placement="bottom start"
        offset={0}
        className="min-w-48"
      >
        <Menu
          aria-label="ポイントのタイプを変更"
          selectionMode="single"
          selectedKeys={[node.data.nodeType]}
        >
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
              </MenuItem>
            );
          })}
        </Menu>
      </MenuPopover>
    </>
  );
}
