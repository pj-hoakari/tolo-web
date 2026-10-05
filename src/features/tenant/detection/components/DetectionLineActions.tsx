import {
  ArrowLeftRight,
  MousePointer2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useCallback } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import {
  applyCountingLines,
  DEFAULT_COUNTING_LINES,
  DEFAULT_LINE_ID,
  type DetectionSettingsStore,
  type DetectionViewStateStore,
  reverseCountingLineDirection,
  selectCountingLineCount,
  selectLine,
  selectLineCreationMode,
  selectSelectedLineId,
  toggleLineCreationMode,
} from "../stores/detectionStore";

type LineActionsProps = {
  settingsStore: DetectionSettingsStore;
  viewStateStore: DetectionViewStateStore;
};

function SelectedLineNameFieldComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  const selectedLineId = useStore(viewStateStore, selectSelectedLineId);
  const selectSelectedLineName = useCallback(
    (state: ReturnType<DetectionSettingsStore["getState"]>) =>
      state.countingLines.find((line) => line.id === selectedLineId)?.name ??
      "",
    [selectedLineId],
  );
  const name = useStore(settingsStore, selectSelectedLineName);
  const t = useTranslations("Detection.lines");

  const updateName = (nextName: string) => {
    const { countingLines } = settingsStore.getState();
    applyCountingLines(
      settingsStore,
      countingLines.map((line) =>
        line.id === selectedLineId ? { ...line, name: nextName } : line,
      ),
    );
  };

  return (
    <TextField
      className="flex w-full flex-col gap-2 sm:max-w-xs"
      value={name}
      onChange={updateName}
    >
      <Label>{t("nameLabel")}</Label>
      <Input placeholder={t("namePlaceholder")} maxLength={40} />
    </TextField>
  );
}

const SelectedLineNameField = memo(SelectedLineNameFieldComponent);

function LineCreationModeToggleComponent({
  viewStateStore,
}: Pick<LineActionsProps, "viewStateStore">) {
  const lineCreationMode = useStore(viewStateStore, selectLineCreationMode);
  const t = useTranslations("Detection.lines");

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
      {lineCreationMode ? t("edit") : t("create")}
    </Button>
  );
}

const LineCreationModeToggle = memo(LineCreationModeToggleComponent);

function ReverseSelectedLineButtonComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  const t = useTranslations("Detection.lines");

  const reverseSelectedLine = () => {
    const { selectedLineId } = viewStateStore.getState();
    const { countingLines } = settingsStore.getState();
    applyCountingLines(
      settingsStore,
      countingLines.map((line) =>
        line.id === selectedLineId ? reverseCountingLineDirection(line) : line,
      ),
    );
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onPress={reverseSelectedLine}
    >
      <ArrowLeftRight className="mr-2 size-4" />
      {t("reverseForward")}
    </Button>
  );
}

const ReverseSelectedLineButton = memo(ReverseSelectedLineButtonComponent);

function DeleteSelectedLineButtonComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  const countingLineCount = useStore(settingsStore, selectCountingLineCount);
  const t = useTranslations("Detection.lines");

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
      {t("deleteSelected")}
    </Button>
  );
}

const DeleteSelectedLineButton = memo(DeleteSelectedLineButtonComponent);

function ResetCountingLinesButtonComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  const t = useTranslations("Detection.lines");

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
      {t("reset")}
    </Button>
  );
}

const ResetCountingLinesButton = memo(ResetCountingLinesButtonComponent);

function DetectionLineActionsComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  return (
    <div className="flex w-full flex-wrap items-end gap-3">
      <SelectedLineNameField
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
      />
      <div className="flex flex-wrap gap-2">
        <LineCreationModeToggle viewStateStore={viewStateStore} />
        <ReverseSelectedLineButton
          settingsStore={settingsStore}
          viewStateStore={viewStateStore}
        />
        <DeleteSelectedLineButton
          settingsStore={settingsStore}
          viewStateStore={viewStateStore}
        />
        <ResetCountingLinesButton
          settingsStore={settingsStore}
          viewStateStore={viewStateStore}
        />
      </div>
    </div>
  );
}

export const DetectionLineActions = memo(DetectionLineActionsComponent);
