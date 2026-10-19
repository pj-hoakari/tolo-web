import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
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
  selectCountingLines,
  selectLine,
  setEditingLine,
} from "../stores/detectionStore";

type DetectionLineCountButtonProps = {
  lineId: string;
  lineName: string;
  index: number;
  resultStore: DetectionResultStore;
  viewStateStore: DetectionViewStateStore;
};

function DetectionLineCountButtonComponent({
  lineId,
  lineName,
  index,
  resultStore,
  viewStateStore,
}: DetectionLineCountButtonProps) {
  const selectCount = useCallback(
    (state: DetectionResult): DetectionLineCount =>
      state.lineCounts[lineId] ?? INITIAL_LINE_COUNT,
    [lineId],
  );
  const selectIsEditing = useCallback(
    (state: DetectionViewState) => state.editingLineId === lineId,
    [lineId],
  );

  const count = useStore(resultStore, selectCount);
  const isEditing = useStore(viewStateStore, selectIsEditing);
  const t = useTranslations("Detection.lines");
  const displayName = lineName || t("defaultName", { index: index + 1 });

  const editLine = () => {
    setEditingLine(viewStateStore, isEditing ? null : lineId);
  };

  return (
    <Button
      type="button"
      variant={isEditing ? "default" : "outline"}
      className={isEditing ? "ring-2 ring-primary ring-offset-2" : undefined}
      size="sm"
      aria-label={t(isEditing ? "stopEditingLine" : "editLine", {
        name: displayName,
      })}
      onPress={editLine}
    >
      <Pencil className="mr-2 size-4" />
      {t(lineName ? "namedCount" : "count", {
        name: lineName,
        index: index + 1,
        forward: count.forward,
        backward: count.backward,
      })}
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
  // ライン配列の各要素を浅く比較して不要な再レンダリングを抑える
  const lines = useStore(settingsStore, useShallow(selectCountingLines));
  const lineIds = lines.map((line) => line.id);

  // 選択中のラインが消えたときの取りこぼしを拾う
  useEffect(() => {
    const { editingLineId, selectedLineId } = viewStateStore.getState();
    if (!lineIds.includes(selectedLineId)) {
      selectLine(viewStateStore, lineIds[0] ?? DEFAULT_LINE_ID);
    }
    if (editingLineId && !lineIds.includes(editingLineId)) {
      setEditingLine(viewStateStore, null);
    }
  }, [lineIds, viewStateStore]);

  return (
    <div className="flex w-full max-w-3xl flex-wrap gap-3 text-sm">
      {lines.map((line, index) => (
        <DetectionLineCountButton
          key={line.id}
          lineId={line.id}
          lineName={line.name}
          index={index}
          resultStore={resultStore}
          viewStateStore={viewStateStore}
        />
      ))}
    </div>
  );
}

export const DetectionLineCountList = memo(DetectionLineCountListComponent);
