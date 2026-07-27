import { Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import type { AliveEdgesStatus } from "@/features/tenant/webrtc/hooks/useAliveEdges";
import type { AliveEdge } from "@/features/tenant/webrtc/type";
import type { GraphEdgeType, GraphNodeData, GraphNodeType } from "../../type";
import { NodeTypeSelector } from "./NodeTypeSelector";
import { buildNodeTypeOptions } from "./nodeTypeOptions";
import { ObservationPointPicker } from "./ObservationPointPicker";
import { SelectionHeader } from "./SelectionHeader";

export type NodePropertiesProps = {
  node: GraphNodeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  observationPoints: AliveEdge[];
  observationPointsStatus?: AliveEdgesStatus;
  usedObservationPointIds: ReadonlySet<string>;
  onRefreshObservationPoints?: () => void;
  onChange: (patch: Partial<GraphNodeData>) => void;
  onChangeObservationPoints: (ids: string[]) => void;
};

/** ポイント（ノード）を選択しているときの編集フォーム */
export function NodeProperties({
  node,
  nodes,
  edges,
  observationPoints,
  observationPointsStatus,
  usedObservationPointIds,
  onRefreshObservationPoints,
  onChange,
  onChangeObservationPoints,
}: NodePropertiesProps) {
  const typeOptions = buildNodeTypeOptions(
    node.id,
    node.data.nodeType,
    nodes,
    edges,
  );

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

      <ObservationPointPicker
        linkedIds={node.data.observationPointIds ?? []}
        available={observationPoints}
        status={observationPointsStatus}
        usedIds={usedObservationPointIds}
        onRefresh={onRefreshObservationPoints}
        onChange={onChangeObservationPoints}
      />
    </div>
  );
}
