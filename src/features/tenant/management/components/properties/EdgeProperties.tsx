import type { AliveEdgesStatus } from "@/features/tenant/webrtc/hooks/useAliveEdges";
import type { AliveEdge } from "@/features/tenant/webrtc/type";
import type { GraphEdgeData, GraphEdgeType, GraphNodeType } from "../../type";
import { EdgeDirectionField } from "./EdgeDirectionField";
import { EdgeEndpoints } from "./EdgeEndpoints";
import { EdgeReverseButton } from "./EdgeReverseButton";
import { resolveEdgeDirectionState } from "./edgeDirectionState";
import { ObservationPointPicker } from "./ObservationPointPicker";
import { SelectionHeader } from "./SelectionHeader";

export type EdgePropertiesProps = {
  edge: GraphEdgeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  observationPoints: AliveEdge[];
  observationPointsStatus?: AliveEdgesStatus;
  usedObservationPointIds: ReadonlySet<string>;
  onRefreshObservationPoints?: () => void;
  sourceLabel: string;
  targetLabel: string;
  onChange: (patch: Partial<GraphEdgeData>) => void;
  onReverse: () => void;
  onChangeObservationPoints: (ids: string[]) => void;
};

/** ルート（エッジ）を選択しているときの編集フォーム */
export function EdgeProperties({
  edge,
  nodes,
  edges,
  observationPoints,
  observationPointsStatus,
  usedObservationPointIds,
  onRefreshObservationPoints,
  sourceLabel,
  targetLabel,
  onChange,
  onReverse,
  onChangeObservationPoints,
}: EdgePropertiesProps) {
  const {
    direction,
    bothDisabled,
    onewayDisabled,
    directionReason,
    reverseDisabled,
    reverseReason,
  } = resolveEdgeDirectionState(edge, nodes, edges);

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <SelectionHeader kind="edge" id={edge.id} />

      <EdgeEndpoints
        sourceLabel={sourceLabel}
        targetLabel={targetLabel}
        direction={direction}
      />

      <EdgeDirectionField
        value={direction}
        bothDisabled={bothDisabled}
        onewayDisabled={onewayDisabled}
        reason={directionReason}
        onChange={(next) => onChange({ direction: next })}
      />

      <EdgeReverseButton
        isDisabled={reverseDisabled}
        reason={reverseReason}
        onPress={onReverse}
      />

      <ObservationPointPicker
        linkedIds={edge.data?.observationPointIds ?? []}
        available={observationPoints}
        status={observationPointsStatus}
        usedIds={usedObservationPointIds}
        onRefresh={onRefreshObservationPoints}
        onChange={onChangeObservationPoints}
      />
    </div>
  );
}
