import { ArrowLeftRight, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, memo, useCallback, useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { JollySelect, SelectItem } from "@/components/ui/select";
import { Input, JollyTextField, TextField } from "@/components/ui/textfield";
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { type ErrorMessageKeys, errorMessageKey } from "@/lib/errorMessageKey";
import type { ObservationPoint } from "@/server/router";
import {
  applyCountingLines,
  DEFAULT_AREA_WIDTH,
  DEFAULT_COUNTING_LINES,
  type DetectionSettingsStore,
  type DetectionViewStateStore,
  reverseCountingLineDirection,
  selectCountingLineCount,
  selectLineCreationMode,
  selectSelectedLineId,
  setEditingLine,
  setLineCreationMode,
} from "../stores/detectionStore";

type LineActionsProps = {
  settingsStore: DetectionSettingsStore;
  viewStateStore: DetectionViewStateStore;
};

export type LineObservationPoints = {
  points: readonly ObservationPoint[];
  add: (name: string) => Promise<ObservationPoint>;
};

const UNASSIGNED = "unassigned";

const ADD_POINT_ERRORS: ErrorMessageKeys<
  "pointInvalid" | "pointExists" | "pointAddFailed"
> = {
  byCode: { BAD_REQUEST: "pointInvalid", CONFLICT: "pointExists" },
  fallback: "pointAddFailed",
};

type AddPointStatus =
  | { kind: "idle" }
  | { kind: "adding" }
  | { kind: "existing"; name: string }
  | { kind: "failed"; messageKey: (typeof ADD_POINT_ERRORS)["fallback"] };

function SelectedLineObservationPointFieldComponent({
  settingsStore,
  viewStateStore,
  observationPoints,
}: LineActionsProps & { observationPoints: LineObservationPoints }) {
  const selectedLineId = useStore(viewStateStore, selectSelectedLineId);
  const selectSelectedLinePointId = useCallback(
    (state: ReturnType<DetectionSettingsStore["getState"]>) =>
      state.countingLines.find((line) => line.id === selectedLineId)
        ?.observationPointId ?? null,
    [selectedLineId],
  );
  const pointId = useStore(settingsStore, selectSelectedLinePointId);
  const t = useTranslations("Detection.lines");
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<AddPointStatus>({ kind: "idle" });
  const { points, add } = observationPoints;
  const items = [
    { observationPointId: UNASSIGNED, name: t("unassigned") },
    ...points,
  ];
  const selectedKey =
    pointId !== null && points.some((p) => p.observationPointId === pointId)
      ? pointId
      : UNASSIGNED;

  const assign = (lineId: string, nextPointId: string | null) => {
    const { countingLines } = settingsStore.getState();
    applyCountingLines(
      settingsStore,
      countingLines.map((line) =>
        line.id === lineId
          ? { ...line, observationPointId: nextPointId }
          : line,
      ),
    );
  };

  async function addPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const lineId = selectedLineId;
    const existing = points.find((p) => p.name === name);
    if (existing) {
      assign(lineId, existing.observationPointId);
      setNewName("");
      setStatus({ kind: "existing", name });
      return;
    }
    setStatus({ kind: "adding" });
    try {
      const point = await add(name);
      assign(lineId, point.observationPointId);
      setNewName("");
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "failed",
        messageKey: errorMessageKey(err, ADD_POINT_ERRORS),
      });
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-wrap items-end gap-3">
        <JollySelect<ObservationPoint>
          className="w-full sm:max-w-xs"
          label={t("pointLabel")}
          items={items}
          selectedKey={selectedKey}
          onSelectionChange={(key) =>
            assign(
              selectedLineId,
              key === null || key === UNASSIGNED ? null : String(key),
            )
          }
        >
          {(point) => (
            <SelectItem id={point.observationPointId} textValue={point.name}>
              {point.name}
            </SelectItem>
          )}
        </JollySelect>
        <form onSubmit={addPoint} className="flex flex-wrap items-end gap-2">
          <JollyTextField
            className="sm:max-w-xs"
            label={t("newPointLabel")}
            value={newName}
            onChange={(value) => {
              setNewName(value);
              if (status.kind !== "adding") setStatus({ kind: "idle" });
            }}
            maxLength={64}
            isDisabled={status.kind === "adding"}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            isDisabled={status.kind === "adding" || !newName.trim()}
          >
            <Plus className="mr-2 size-4" />
            {t("addPoint")}
          </Button>
        </form>
      </div>
      {status.kind === "existing" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("pointExisting", { name: status.name })}
        </p>
      )}
      {status.kind === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {t(status.messageKey)}
        </p>
      )}
    </div>
  );
}

const SelectedLineObservationPointField = memo(
  SelectedLineObservationPointFieldComponent,
);

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

function SelectedLineAreaWidthFieldComponent({
  settingsStore,
  viewStateStore,
}: LineActionsProps) {
  const selectedLineId = useStore(viewStateStore, selectSelectedLineId);
  const selectSelectedLineAreaWidth = useCallback(
    (state: ReturnType<DetectionSettingsStore["getState"]>) =>
      state.countingLines.find((line) => line.id === selectedLineId)
        ?.areaWidth ?? DEFAULT_AREA_WIDTH,
    [selectedLineId],
  );
  const areaWidth = useStore(settingsStore, selectSelectedLineAreaWidth);
  const t = useTranslations("Detection.lines");

  const updateAreaWidth = (percent: number) => {
    const { countingLines } = settingsStore.getState();
    applyCountingLines(
      settingsStore,
      countingLines.map((line) =>
        line.id === selectedLineId
          ? { ...line, areaWidth: percent / 100 }
          : line,
      ),
    );
  };

  return (
    <TextField className="flex w-full flex-col gap-2 sm:max-w-xs">
      <Label>{t("areaWidthLabel")}</Label>
      <Input
        type="number"
        min={1}
        max={100}
        step={1}
        value={Math.round(areaWidth * 100)}
        onChange={(event) => updateAreaWidth(Number(event.currentTarget.value))}
      />
    </TextField>
  );
}

const SelectedLineAreaWidthField = memo(SelectedLineAreaWidthFieldComponent);

function DetectionLineCreationModeToggleComponent({
  viewStateStore,
}: Pick<LineActionsProps, "viewStateStore">) {
  const lineCreationMode = useStore(viewStateStore, selectLineCreationMode);
  const t = useTranslations("Detection.lines");

  return (
    <ToggleButtonGroup
      aria-label={t("modeLabel")}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[lineCreationMode ? "create" : "edit"]}
      onSelectionChange={(keys) => {
        if (keys.has("create")) {
          setLineCreationMode(viewStateStore, true);
        } else if (keys.has("edit")) {
          setEditingLine(
            viewStateStore,
            viewStateStore.getState().selectedLineId,
          );
        }
      }}
      className="w-full rounded-lg border border-input bg-muted p-1 sm:w-auto"
    >
      <Toggle
        id="create"
        size="sm"
        className="selected:bg-primary selected:text-primary-foreground selected:shadow-sm flex-1 gap-2 px-3 whitespace-nowrap"
      >
        <Plus aria-hidden="true" className="size-4" />
        {t("create")}
      </Toggle>
      <Toggle
        id="edit"
        size="sm"
        className="selected:bg-primary selected:text-primary-foreground selected:shadow-sm flex-1 gap-2 px-3 whitespace-nowrap"
      >
        <Pencil aria-hidden="true" className="size-4" />
        {t("edit")}
      </Toggle>
    </ToggleButtonGroup>
  );
}

export const DetectionLineCreationModeToggle = memo(
  DetectionLineCreationModeToggleComponent,
);

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
    setEditingLine(viewStateStore, nextLines[0]?.id ?? null);
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
    setEditingLine(viewStateStore, DEFAULT_COUNTING_LINES[0].id);
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
  showLineCreationModeToggle = true,
  observationPoints,
}: LineActionsProps & {
  showLineCreationModeToggle?: boolean;
  observationPoints?: LineObservationPoints;
}) {
  return (
    <div className="flex w-full flex-wrap items-end gap-3">
      <SelectedLineNameField
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
      />
      {observationPoints && (
        <SelectedLineObservationPointField
          settingsStore={settingsStore}
          viewStateStore={viewStateStore}
          observationPoints={observationPoints}
        />
      )}
      <SelectedLineAreaWidthField
        settingsStore={settingsStore}
        viewStateStore={viewStateStore}
      />
      <div className="flex flex-wrap gap-2">
        {showLineCreationModeToggle && (
          <DetectionLineCreationModeToggle viewStateStore={viewStateStore} />
        )}
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
