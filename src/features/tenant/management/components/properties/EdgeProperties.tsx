import type { GraphEdgeData, GraphEdgeType } from "../../type";
import { EdgeDirectionField } from "./EdgeDirectionField";
import { type EdgeEndpointLabels, EdgeEndpoints } from "./EdgeEndpoints";
import { EdgeReverseButton } from "./EdgeReverseButton";
import type { EdgeDirectionState } from "./edgeDirectionState";
import {
  ObservationPointPicker,
  type ObservationPointsSource,
} from "./ObservationPointPicker";
import { SelectionHeader } from "./SelectionHeader";

export type EdgePropertiesProps = {
  edge: GraphEdgeType;
  /** 方向・反転操作の可否（`resolveEdgeDirectionState` の結果） */
  directionState: EdgeDirectionState;
  endpoints: EdgeEndpointLabels;
  observationPoints: ObservationPointsSource;
  onChange: (patch: Partial<GraphEdgeData>) => void;
  onReverse: () => void;
  onChangeObservationPoints: (ids: string[]) => void;
};

/** ルート（エッジ）を選択しているときの編集フォーム */
export function EdgeProperties({
  edge,
  directionState,
  endpoints,
  observationPoints,
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
  } = directionState;

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <SelectionHeader kind="edge" id={edge.id} />

      <EdgeEndpoints {...endpoints} direction={direction} />

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
        {...observationPoints}
        linkedIds={edge.data?.observationPointIds ?? []}
        onChange={onChangeObservationPoints}
      />
    </div>
  );
}
