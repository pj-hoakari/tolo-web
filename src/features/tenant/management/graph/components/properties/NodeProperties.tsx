import { Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import type { GraphNodeData, GraphNodeType } from "../../type";
import { NodeTypeSelector } from "./NodeTypeSelector";
import type { NodeTypeOption } from "./nodeTypeOptions";
import { SelectionHeader } from "./SelectionHeader";

export type NodePropertiesProps = {
  node: GraphNodeType;
  /** 各ノードタイプの選択可否（`buildNodeTypeOptions` の結果） */
  typeOptions: NodeTypeOption[];
  onChange: (patch: Partial<GraphNodeData>) => void;
};

/**
 * ポイント（ノード）を選択しているときの編集フォーム。
 * 扱うのはグラフ構造そのものだけで、観測点の紐づけは表示側
 * （`ObservationLinkPanel`）が担当する。
 */
export function NodeProperties({
  node,
  typeOptions,
  onChange,
}: NodePropertiesProps) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <SelectionHeader kind="node" id={node.id} />

      <TextField
        value={node.data.label}
        onChange={(value) => onChange({ label: value })}
        className="flex flex-col gap-1"
      >
        <Label className="text-[11px] text-muted-foreground">ラベル</Label>
        <Input className="h-auto px-2 py-1 text-xs" />
      </TextField>

      <NodeTypeSelector
        value={node.data.nodeType}
        options={typeOptions}
        notices={node.data.notices}
        onChange={(nodeType) => onChange({ nodeType })}
      />
    </div>
  );
}
