import {
  type GetGuideMapResponse,
  GuideMapConnectorDirection,
  GuideMapConnectorType,
  type GuideMapObject,
  GuideMapPlaceShape,
} from "@pj-hoakari/tolo-guest-client-es/tolo/guest/v1/guest_pb";
import type {
  ConnectorDirection,
  ConnectorType,
  LocalizedMapObject,
  PlaceShape,
} from "@/features/guest/info/guideMapLayout";
import type { GuestGuideMap } from "./router";

const PLACE_SHAPES: Partial<Record<GuideMapPlaceShape, PlaceShape>> = {
  [GuideMapPlaceShape.PIN]: "pin",
  [GuideMapPlaceShape.RECT]: "rect",
  [GuideMapPlaceShape.CIRCLE]: "circle",
};

const CONNECTOR_TYPES: Partial<Record<GuideMapConnectorType, ConnectorType>> = {
  [GuideMapConnectorType.STAIRS]: "stairs",
  [GuideMapConnectorType.ESCALATOR]: "escalator",
  [GuideMapConnectorType.ELEVATOR]: "elevator",
};

const CONNECTOR_DIRECTIONS: Partial<
  Record<GuideMapConnectorDirection, ConnectorDirection>
> = {
  [GuideMapConnectorDirection.BOTH]: "both",
  [GuideMapConnectorDirection.UP]: "up",
  [GuideMapConnectorDirection.DOWN]: "down",
};

const textOf = (texts: Record<string, string>) =>
  Object.keys(texts).length > 0 ? texts : undefined;

function toMapObject(o: GuideMapObject): LocalizedMapObject[] {
  const base = {
    id: o.objectId,
    groupId: o.groupId,
    title: textOf(o.title),
    description: textOf(o.description),
    color: o.color,
    closed: o.closed || undefined,
    pointId: o.pointId || undefined,
    routeId: o.routeId || undefined,
  };
  const points = (ps: { x: number; y: number }[]) =>
    ps.map(({ x, y }) => ({ x, y }));
  switch (o.kind.case) {
    case "place": {
      const p = o.kind.value;
      const shape = PLACE_SHAPES[p.shape];
      if (!shape) return [];
      const connector = p.connector && CONNECTOR_TYPES[p.connector.type];
      return [
        {
          ...base,
          kind: "place",
          x: p.center?.x ?? 0,
          y: p.center?.y ?? 0,
          shape,
          w: p.width,
          h: p.height,
          pin: p.pin || undefined,
          markW: p.markWidth,
          markH: p.markHeight,
          ...(connector && p.connector
            ? {
                connector,
                link: p.connector.link,
                direction: CONNECTOR_DIRECTIONS[p.connector.direction],
              }
            : {}),
        },
      ];
    }
    case "line":
      return [
        {
          ...base,
          kind: "line",
          points: points(o.kind.value.points),
          width: o.kind.value.width,
          dash: o.kind.value.dash,
        },
      ];
    case "area":
      return [{ ...base, kind: "area", points: points(o.kind.value.points) }];
    case "text":
      return [
        {
          ...base,
          kind: "text",
          x: o.kind.value.position?.x ?? 0,
          y: o.kind.value.position?.y ?? 0,
          size: o.kind.value.size,
        },
      ];
    default:
      return [];
  }
}

export function fromGuideMapResponse(res: GetGuideMapResponse): GuestGuideMap {
  return {
    graph: {
      points: (res.graph?.points ?? []).map((p) => ({
        pointId: p.pointId,
        labels: p.labels,
      })),
      groups: (res.graph?.groups ?? []).map((g) => ({
        groupId: g.groupId,
        labels: g.labels,
      })),
    },
    layout: {
      version: 1,
      groups: (res.layout?.groups ?? []).map((g) => ({ groupId: g.groupId })),
      objects: (res.layout?.objects ?? []).flatMap(toMapObject),
      north: res.layout?.north ?? 0,
      scale: res.layout?.scale ?? 0,
      startId: res.layout?.startObjectId || undefined,
    },
    currentPointId: res.currentPointId || undefined,
  };
}
