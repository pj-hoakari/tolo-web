import {
  type DetectedPeopleTally,
  type DetectionCountingLineSetting,
  type DetectionPoint,
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

type Segment = { p1: DetectionPoint; p2: DetectionPoint };

function distanceToSegment(point: DetectionPoint, { p1, p2 }: Segment): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared,
          ),
        );
  return Math.hypot(point.x - (p1.x + t * dx), point.y - (p1.y + t * dy));
}

export function countPeopleByObservationPoint(
  people: readonly DetectionPoint[],
  linesByPoint: ReadonlyMap<string, readonly Segment[]>,
): Map<string, number> {
  const counts = new Map([...linesByPoint.keys()].map((id) => [id, 0]));
  for (const person of people) {
    let nearest: string | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const [pointId, lines] of linesByPoint) {
      for (const line of lines) {
        const distance = distanceToSegment(person, line);
        if (distance < nearestDistance) {
          nearest = pointId;
          nearestDistance = distance;
        }
      }
    }
    if (nearest !== undefined) {
      counts.set(nearest, (counts.get(nearest) ?? 0) + 1);
    }
  }
  return counts;
}

function meanDetectedPeople(
  previous: DetectedPeopleTally,
  current: DetectedPeopleTally,
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
  const byPoint = new Map<string, WindowMeasurement>();
  for (const [lineId, observationPointId] of pointIdByLineId) {
    const before = previous.lineCounts[lineId] ?? INITIAL_LINE_COUNT;
    const after = current.lineCounts[lineId] ?? INITIAL_LINE_COUNT;
    const mean = meanDetectedPeople(
      previous.detectedPeople[observationPointId] ?? INITIAL_DETECTED_PEOPLE,
      current.detectedPeople[observationPointId] ?? INITIAL_DETECTED_PEOPLE,
    );
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
