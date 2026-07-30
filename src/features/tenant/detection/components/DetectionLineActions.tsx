import { MousePointer2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { memo } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import {
  applyCountingLines,
  DEFAULT_COUNTING_LINES,
  DEFAULT_LINE_ID,
  type DetectionSettingsStore,
  type DetectionViewStateStore,
  selectCountingLineCount,
  selectLine,
  selectLineCreationMode,
  toggleLineCreationMode,
} from "../stores/detectionStore";

type LineActionsProps = {
  settingsStore: DetectionSettingsStore;
  viewStateStore: DetectionViewStateStore;
};

function LineCreationModeToggleComponent({
  viewStateStore,
}: Pick<LineActionsProps, "viewStateStore">) {
  const lineCreationMode = useStore(viewStateStore, selectLineCreationMode);

  return (
    <Button
      type="button"
      variant={lineCreationMode ? "default" : "outline"}
      size="sm"
      onPress={() => toggleLineCreationMode(viewStateStore)}
    >
      {lineCreationMode ? (
        <MousePointer2 className="mr-2 size-4" />
      ) : (
        <Plus className="mr-2 size-4" />
      )}
      {lineCreationMode ? "編集モード" : "ライン生成"}
    </Button>
  );
}

const LineCreationModeToggle = memo(LineCreationModeToggleComponent);

function DeleteSelectedLineButtonComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  const countingLineCount = useStore(settingsStore, selectCountingLineCount);

  const deleteSelectedLine = () => {
    const { countingLines } = settingsStore.getState();
    if (countingLines.length <= 1) {
      return;
    }

    const { selectedLineId } = viewStateStore.getState();
    const nextLines = countingLines.filter(
      (line) => line.id !== selectedLineId,
    );
    selectLine(viewStateStore, nextLines[0]?.id ?? DEFAULT_LINE_ID);
    applyCountingLines(settingsStore, nextLines);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onPress={deleteSelectedLine}
      isDisabled={countingLineCount <= 1}
    >
      <Trash2 className="mr-2 size-4" />
      選択ラインを削除
    </Button>
  );
}

const DeleteSelectedLineButton = memo(DeleteSelectedLineButtonComponent);

function ResetCountingLinesButtonComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  const resetCountingLines = () => {
    selectLine(viewStateStore, DEFAULT_COUNTING_LINES[0].id);
    applyCountingLines(settingsStore, DEFAULT_COUNTING_LINES);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onPress={resetCountingLines}
    >
      <RotateCcw className="mr-2 size-4" />
      ラインを初期位置に戻す
    </Button>
  );
}

const ResetCountingLinesButton = memo(ResetCountingLinesButtonComponent);

function DetectionLineActionsComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <LineCreationModeToggle viewStateStore={viewStateStore} />
      <DeleteSelectedLineButton
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
      />
      <ResetCountingLinesButton
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
      />
    </div>
  );
}

export const DetectionLineActions = memo(DetectionLineActionsComponent);
