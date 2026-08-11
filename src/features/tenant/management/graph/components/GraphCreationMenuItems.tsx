import type { XYPosition } from "@xyflow/react";
import { MapPinPlus, Route, SquareDashed, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NodeType } from "../type";
import { ContextMenuItem } from "./ContextMenuItem";

export type GraphCreationMenuItemsProps = {
  /** 追加する要素を置くフロー座標（右クリック位置） */
  nodePosition: XYPosition;
  nodeType: NodeType;
  onAddNode: (position: XYPosition, nodeType: NodeType) => void;
  onAddGroup: (position: XYPosition) => void;
  isEdgeCreationActive: boolean;
  onStartEdgeCreation: () => void;
  onEndEdgeCreation: () => void;
};

/**
 * 背景・グループの両メニューで共通の要素追加系項目
 * （ポイント追加・グループ追加・ルート追加）。
 * ルート追加モード中は追加操作の代わりに終了操作だけを出す。
 */
export function GraphCreationMenuItems({
  nodePosition,
  nodeType,
  onAddNode,
  onAddGroup,
  isEdgeCreationActive,
  onStartEdgeCreation,
  onEndEdgeCreation,
}: GraphCreationMenuItemsProps) {
  const t = useTranslations("Graph.contextMenu");

  if (isEdgeCreationActive) {
    return (
      <ContextMenuItem
        id="end-edge-creation"
        icon={X}
        label={t("endEdgeCreation")}
        onAction={onEndEdgeCreation}
      />
    );
  }

  return (
    <>
      <ContextMenuItem
        id="add-node"
        icon={MapPinPlus}
        label={t("addNode")}
        onAction={() => onAddNode(nodePosition, nodeType)}
      />
      <ContextMenuItem
        id="add-group"
        icon={SquareDashed}
        label={t("addGroup")}
        onAction={() => onAddGroup(nodePosition)}
      />
      <ContextMenuItem
        id="add-edge"
        icon={Route}
        label={t("addEdge")}
        onAction={onStartEdgeCreation}
      />
    </>
  );
}
