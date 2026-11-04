import type { DetectionPoint } from "../stores/detectionStore";

export type AreaPolygon = readonly DetectionPoint[];

export type PixelAreaLine = {
  name: string;
  p1: DetectionPoint;
  p2: DetectionPoint;
  areaWidth: number;
};

export function lineArea({ p1, p2, areaWidth }: PixelAreaLine): AreaPolygon {
  const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (length === 0) {
    return [];
  }
  const offsetX = (-(p2.y - p1.y) / length) * (areaWidth / 2);
  const offsetY = ((p2.x - p1.x) / length) * (areaWidth / 2);
  return [
    { x: p1.x + offsetX, y: p1.y + offsetY },
    { x: p2.x + offsetX, y: p2.y + offsetY },
    { x: p2.x - offsetX, y: p2.y - offsetY },
    { x: p1.x - offsetX, y: p1.y - offsetY },
  ];
}

export function observationPointAreas(
  lines: readonly PixelAreaLine[],
  pointIdByName: ReadonlyMap<string, string>,
): Map<string, AreaPolygon[]> {
  const areas = new Map<string, AreaPolygon[]>();
  for (const line of lines) {
    const pointId = pointIdByName.get(line.name);
    if (pointId) {
      areas.set(pointId, [...(areas.get(pointId) ?? []), lineArea(line)]);
    }
  }
  return areas;
}

export function isInsideArea(
  point: DetectionPoint,
  polygon: AreaPolygon,
): boolean {
  if (polygon.length < 3) {
    return false;
  }
  let sign = 0;
  for (const [index, from] of polygon.entries()) {
    const to = polygon[(index + 1) % polygon.length];
    const cross =
      (to.x - from.x) * (point.y - from.y) -
      (to.y - from.y) * (point.x - from.x);
    if (cross !== 0) {
      if (sign !== 0 && Math.sign(cross) !== sign) {
        return false;
      }
      sign = Math.sign(cross);
    }
  }
  return true;
}

export function countPeopleInAreas(
  people: readonly DetectionPoint[],
  areasByPoint: ReadonlyMap<string, readonly AreaPolygon[]>,
): Map<string, number> {
  return new Map(
    [...areasByPoint].map(([pointId, areas]) => [
      pointId,
      people.filter((person) =>
        areas.some((area) => isInsideArea(person, area)),
      ).length,
    ]),
  );
}

function project(polygon: AreaPolygon, axis: DetectionPoint) {
  const values = polygon.map((p) => p.x * axis.x + p.y * axis.y);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function areasOverlap(a: AreaPolygon, b: AreaPolygon): boolean {
  if (a.length < 3 || b.length < 3) {
    return false;
  }
  for (const polygon of [a, b]) {
    for (const [index, from] of polygon.entries()) {
      const to = polygon[(index + 1) % polygon.length];
      const axis = { x: from.y - to.y, y: to.x - from.x };
      const pa = project(a, axis);
      const pb = project(b, axis);
      if (pa.max <= pb.min || pb.max <= pa.min) {
        return false;
      }
    }
  }
  return true;
}

export function findOverlappingAreaNames(
  lines: readonly PixelAreaLine[],
): [string, string][] {
  const pairs = new Map<string, [string, string]>();
  for (const [index, a] of lines.entries()) {
    for (const b of lines.slice(index + 1)) {
      if (!a.name || !b.name || a.name === b.name) {
        continue;
      }
      const key = JSON.stringify([a.name, b.name].sort());
      if (!pairs.has(key) && areasOverlap(lineArea(a), lineArea(b))) {
        pairs.set(key, [a.name, b.name]);
      }
    }
  }
  return [...pairs.values()];
}
