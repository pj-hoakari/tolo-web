import type { WindowMeasurement } from "./measurements";

export type MeasurementRecordContext = {
  eventId: string;
  edgeDeviceId: string;
};

export type MeasurementRecord = {
  eventId: string;
  edgeDeviceId: string;
  observationPointId: string;
  observationPointName: string;
  windowStart: string;
  windowEnd: string;
  countIn: number;
  countOut: number;
  meanDetectedPeople?: number;
  sent: boolean;
};

const listeners = new Set<() => void>();
let writeFailed = false;
let version = 0;

export const measurementRecordsVersion = () => version;

export const measurementRecordingFailed = () => writeFailed;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

const storageKey = ({ eventId, edgeDeviceId }: MeasurementRecordContext) =>
  `tolo:observation-measurements:${eventId}:${edgeDeviceId}`;

const recordKey = (m: { observationPointId: string; windowStart: string }) =>
  `${m.observationPointId}@${m.windowStart}`;

export function readMeasurementRecords(
  context: MeasurementRecordContext,
): MeasurementRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey(context));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MeasurementRecord[]) : [];
  } catch {
    return [];
  }
}

function writeMeasurementRecords(
  context: MeasurementRecordContext,
  records: MeasurementRecord[],
): void {
  try {
    window.localStorage.setItem(storageKey(context), JSON.stringify(records));
    writeFailed = false;
  } catch (cause) {
    console.error("failed to record measurements on this device", cause);
    writeFailed = true;
  }
  notify();
}

export function recordMeasurements(
  context: MeasurementRecordContext,
  measurements: readonly WindowMeasurement[],
  nameByPointId: ReadonlyMap<string, string>,
): void {
  if (measurements.length === 0 || typeof window === "undefined") return;
  writeMeasurementRecords(context, [
    ...readMeasurementRecords(context),
    ...measurements.map((m) => ({
      ...context,
      observationPointId: m.observationPointId,
      observationPointName: nameByPointId.get(m.observationPointId) ?? "",
      windowStart: m.windowStart.toISOString(),
      windowEnd: m.windowEnd.toISOString(),
      countIn: m.countIn,
      countOut: m.countOut,
      ...(m.meanDetectedPeople === undefined
        ? {}
        : { meanDetectedPeople: m.meanDetectedPeople }),
      sent: false,
    })),
  ]);
}

export function markMeasurementsSent(
  context: MeasurementRecordContext,
  measurements: readonly WindowMeasurement[],
): void {
  if (measurements.length === 0 || typeof window === "undefined") return;
  const sent = new Set(
    measurements.map((m) =>
      recordKey({
        observationPointId: m.observationPointId,
        windowStart: m.windowStart.toISOString(),
      }),
    ),
  );
  writeMeasurementRecords(
    context,
    readMeasurementRecords(context).map((record) =>
      sent.has(recordKey(record)) ? { ...record, sent: true } : record,
    ),
  );
}

export function clearMeasurementRecords(
  context: MeasurementRecordContext,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(context));
  notify();
}

export function toJsonLines(records: readonly MeasurementRecord[]): string {
  return records.map((record) => `${JSON.stringify(record)}\n`).join("");
}

export function subscribeMeasurementRecords(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
