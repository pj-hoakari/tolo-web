import { useTranslations } from "next-intl";
import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  clearMeasurementRecords,
  measurementRecordingFailed,
  measurementRecordsVersion,
  readMeasurementRecords,
  subscribeMeasurementRecords,
  toJsonLines,
} from "../utils/measurementRecords";

export function MeasurementRecordPanel({
  eventId,
  edgeDeviceId,
}: {
  eventId: string;
  edgeDeviceId: string;
}) {
  const t = useTranslations("Observation.records");
  const version = useSyncExternalStore(
    subscribeMeasurementRecords,
    measurementRecordsVersion,
    () => -1,
  );
  const records = useMemo(
    () =>
      version === -1 ? [] : readMeasurementRecords({ eventId, edgeDeviceId }),
    [eventId, edgeDeviceId, version],
  );
  const unsent = records.filter((record) => !record.sent).length;

  const exportRecords = () => {
    const url = URL.createObjectURL(
      new Blob([toJsonLines(records)], { type: "application/x-ndjson" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `observation-${eventId}-${edgeDeviceId}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const clearRecords = () => {
    if (window.confirm(t("clearConfirm", { count: records.length }))) {
      clearMeasurementRecords({ eventId, edgeDeviceId });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{t("summary", { count: records.length, unsent })}</span>
      <Button
        variant="secondary"
        size="sm"
        onPress={exportRecords}
        isDisabled={records.length === 0}
      >
        {t("export")}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onPress={clearRecords}
        isDisabled={records.length === 0}
      >
        {t("clear")}
      </Button>
      {measurementRecordingFailed() && (
        <p role="alert" className="w-full text-destructive">
          {t("writeFailed")}
        </p>
      )}
    </div>
  );
}
