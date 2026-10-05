import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import {
  DEFAULT_LINE_ID,
  type DetectionLineCount,
  type DetectionResult,
  type DetectionResultStore,
  type DetectionSettingsStore,
  type DetectionViewStateStore,
  INITIAL_LINE_COUNT,
  selectCountingLines,
  selectLine,
  setLineCreationMode,
} from "../stores/detectionStore";

type DetectionLineCountButtonProps = {
  lineId: string;
  lineName: string;
  index: number;
  resultStore: DetectionResultStore;
};

function DetectionLineCountButtonComponent({
  lineId,
  lineName,
  index,
  resultStore,
}: DetectionLineCountButtonProps) {
  const selectCount = useCallback(
    (state: DetectionResult): DetectionLineCount =>
      state.lineCounts[lineId] ?? INITIAL_LINE_COUNT,
    [lineId],
  );
  const count = useStore(resultStore, selectCount);
  const t = useTranslations("Detection.lines");
  const displayName = lineName || t("defaultName", { index: index + 1 });

  const editLine = () => {
    selectLine(viewStateStore, lineId);
    setLineCreationMode(viewStateStore, false);
  };

  return (
    <Toggle
      id={lineId}
      variant="outline"
      size="sm"
      aria-label={t("editLine", { name: displayName })}
      onPress={editLine}
    >
      <Pencil className="mr-2 size-4" />
      {t(lineName ? "namedCount" : "count", {
        name: lineName,
        index: index + 1,
        forward: count.forward,
        backward: count.backward,
      })}
    </Toggle>
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
  const selectedLineId = useStore(viewStateStore, selectSelectedLineId);
  const t = useTranslations("Detection.lines");

  // 選択中のラインが消えたときの取りこぼしを拾う
  useEffect(() => {
    if (!lineIds.includes(viewStateStore.getState().selectedLineId)) {
      selectLine(viewStateStore, lineIds[0] ?? DEFAULT_LINE_ID);
    }
  }, [lineIds, viewStateStore]);

  return (
    <ToggleButtonGroup
      aria-label={t("listLabel")}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[selectedLineId]}
      onSelectionChange={(keys) => {
        const [lineId] = keys;
        if (typeof lineId === "string") {
          selectLine(viewStateStore, lineId);
        }
      }}
      className="w-full max-w-3xl flex-wrap justify-start gap-3"
    >
      {lines.map((line, index) => (
        <DetectionLineCountButton
          key={line.id}
          lineId={line.id}
          lineName={line.name}
          index={index}
          resultStore={resultStore}
        />
      ))}
    </ToggleButtonGroup>
  );
}

export const DetectionLineCountList = memo(DetectionLineCountListComponent);
