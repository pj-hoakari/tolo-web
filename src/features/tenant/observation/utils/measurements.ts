import {
  type DetectionCountingLineSetting,
  type DetectionLineCount,
  INITIAL_LINE_COUNT,
} from "@/features/tenant/detection/stores/detectionStore";

export type WindowMeasurement = {
  observationPointId: string;
  windowStart: Date;
  windowEnd: Date;
  countIn: number;
  countOut: number;
};

function delta(previous: number, current: number): number {
  return current >= previous ? current - previous : current;
}

export function mapLinesToObservationPoints(
  lines: DetectionCountingLineSetting[],
  pointIdByName: ReadonlyMap<string, string>,
): Map<string, string> {
  const pointIdByLineId = new Map<string, string>();
  for (const line of lines) {
    const pointId = pointIdByName.get(line.name);
    if (pointId) {
      pointIdByLineId.set(line.id, pointId);
    }
  }
  return pointIdByLineId;
}

export function buildWindowMeasurements({
  pointIdByLineId,
  previous,
  current,
  windowStart,
  windowEnd,
}: {
  pointIdByLineId: ReadonlyMap<string, string>;
  previous: Record<string, DetectionLineCount>;
  current: Record<string, DetectionLineCount>;
  windowStart: Date;
  windowEnd: Date;
}): WindowMeasurement[] {
  const byPoint = new Map<string, WindowMeasurement>();
  for (const [lineId, observationPointId] of pointIdByLineId) {
    const before = previous[lineId] ?? INITIAL_LINE_COUNT;
    const after = current[lineId] ?? INITIAL_LINE_COUNT;
    const measurement = byPoint.get(observationPointId) ?? {
      observationPointId,
      windowStart,
      windowEnd,
      countIn: 0,
      countOut: 0,
    };
    measurement.countIn += delta(before.forward, after.forward);
    measurement.countOut += delta(before.backward, after.backward);
    byPoint.set(observationPointId, measurement);
  }
  return [...byPoint.values()];
}
