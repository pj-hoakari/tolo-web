import { memo, useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LINE_ID,
  type DetectionLineCount,
  type DetectionResult,
  type DetectionResultStore,
  type DetectionSettingsStore,
  type DetectionViewState,
  type DetectionViewStateStore,
  INITIAL_LINE_COUNT,
  selectCountingLineIds,
  selectLine,
} from "../stores/detectionStore";

type DetectionLineCountButtonProps = {
  lineId: string;
  index: number;
  resultStore: DetectionResultStore;
  viewStateStore: DetectionViewStateStore;
};

function DetectionLineCountButtonComponent({
  lineId,
  index,
  resultStore,
  viewStateStore,
}: DetectionLineCountButtonProps) {
  const selectCount = useCallback(
    (state: DetectionResult): DetectionLineCount =>
      state.lineCounts[lineId] ?? INITIAL_LINE_COUNT,
    [lineId],
  );
  const selectIsSelected = useCallback(
    (state: DetectionViewState) => state.selectedLineId === lineId,
    [lineId],
  );

  const count = useStore(resultStore, selectCount);
  const isSelected = useStore(viewStateStore, selectIsSelected);

  return (
    <Button
      type="button"
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onPress={() => selectLine(viewStateStore, lineId)}
    >
      ライン {index + 1}: forward {count.forward} / backward {count.backward}
    </Button>
  );
}

const DetectionLineCountButton = memo(DetectionLineCountButtonComponent);

export type DetectionLineCountListProps = {
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
  viewStateStore: DetectionViewStateStore;
};

/**
 * ライン一覧
 */
function DetectionLineCountListComponent({
  settingsStore,
  resultStore,
  viewStateStore,
}: DetectionLineCountListProps) {
  // id の配列は毎回組み立て直されるので浅い比較で再レンダリングを抑える
  const lineIds = useStore(settingsStore, useShallow(selectCountingLineIds));

  // 選択中のラインが消えたときの取りこぼしを拾う
  useEffect(() => {
    if (!lineIds.includes(viewStateStore.getState().selectedLineId)) {
      selectLine(viewStateStore, lineIds[0] ?? DEFAULT_LINE_ID);
    }
  }, [lineIds, viewStateStore]);

  return (
    <div className="flex w-full max-w-3xl flex-wrap gap-3 text-sm">
      {lineIds.map((lineId, index) => (
        <DetectionLineCountButton
          key={lineId}
          lineId={lineId}
          index={index}
          resultStore={resultStore}
          viewStateStore={viewStateStore}
        />
      ))}
    </div>
  );
}

export const DetectionLineCountList = memo(DetectionLineCountListComponent);
