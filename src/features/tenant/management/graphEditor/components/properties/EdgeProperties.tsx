import type { GraphEdgeData, GraphEdgeType } from "../../type";
import { EdgeDirectionField } from "./EdgeDirectionField";
import { type EdgeEndpointLabels, EdgeEndpoints } from "./EdgeEndpoints";
import { EdgeReverseButton } from "./EdgeReverseButton";
import type { EdgeDirectionState } from "./edgeDirectionState";
import { SelectionHeader } from "./SelectionHeader";

export type EdgePropertiesProps = {
  edge: GraphEdgeType;
  /** 方向・反転操作の可否（`resolveEdgeDirectionState` の結果） */
  directionState: EdgeDirectionState;
  endpoints: EdgeEndpointLabels;
  onChange: (patch: Partial<GraphEdgeData>) => void;
  onReverse: () => void;
};

/**
 * ルート（エッジ）を選択しているときの編集フォーム。
 * 扱うのはグラフ構造そのものだけで、観測点の紐づけは表示側
 * （`ObservationLinkPanel`）が担当する。
 */
export function EdgeProperties({
  edge,
  directionState,
  endpoints,
  onChange,
  onReverse,
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
    </div>
  );
}
