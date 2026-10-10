import {
  type DetectionCountingLineSetting,
  type DetectionResult,
  INITIAL_DETECTED_PEOPLE,
  INITIAL_LINE_COUNT,
} from "@/features/tenant/detection/stores/detectionStore";

export type WindowMeasurement = {
  observationPointId: string;
  windowStart: Date;
  windowEnd: Date;
  countIn: number;
  countOut: number;
  meanDetectedPeople?: number;
};

type ResultSnapshot = Pick<DetectionResult, "lineCounts" | "detectedPeople">;

function delta(previous: number, current: number): number {
  return current >= previous ? current - previous : current;
}

function meanDetectedPeople(
  previous: ResultSnapshot["detectedPeople"],
  current: ResultSnapshot["detectedPeople"],
): number | undefined {
  const base =
    current.frames >= previous.frames ? previous : INITIAL_DETECTED_PEOPLE;
  const frames = current.frames - base.frames;
  return frames > 0 ? (current.people - base.people) / frames : undefined;
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
  previous: ResultSnapshot;
  current: ResultSnapshot;
  windowStart: Date;
  windowEnd: Date;
}): WindowMeasurement[] {
  const mean = meanDetectedPeople(
    previous.detectedPeople,
    current.detectedPeople,
  );
  const byPoint = new Map<string, WindowMeasurement>();
  for (const [lineId, observationPointId] of pointIdByLineId) {
    const before = previous.lineCounts[lineId] ?? INITIAL_LINE_COUNT;
    const after = current.lineCounts[lineId] ?? INITIAL_LINE_COUNT;
    const measurement = byPoint.get(observationPointId) ?? {
      observationPointId,
      windowStart,
      windowEnd,
      countIn: 0,
      countOut: 0,
      ...(mean === undefined ? {} : { meanDetectedPeople: mean }),
    };
    measurement.countIn += delta(before.forward, after.forward);
    measurement.countOut += delta(before.backward, after.backward);
    byPoint.set(observationPointId, measurement);
  }
  return [...byPoint.values()];
}
