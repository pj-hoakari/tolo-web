import { create, type MessageInitShape } from "@bufbuild/protobuf";
import {
  GuideMapConnectorDirection,
  GuideMapConnectorType,
  type GuideMapLayout,
  GuideMapLayoutSchema,
  type GuideMapObject,
  type GuideMapObjectSchema,
  GuideMapPlaceShape,
  type LocalizedText,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import type {
  ConnectorDirection,
  ConnectorType,
  LocalizedGuideMapLayout,
  LocalizedMapObject,
  PlaceShape,
} from "@/features/guest/info/guideMapLayout";
import type { LocalizedLabel } from "@/features/tenant/management/graph/type";

// 案内マップエディタの案内マップ（LocalizedGuideMapLayout）と、Graph Authoring の GuideMapLayout の相互変換。
// Graph Authoring に無い項目（階の下敷き画像・写真）は保存されない

const PLACE_SHAPES: Record<PlaceShape, GuideMapPlaceShape> = {
  pin: GuideMapPlaceShape.PIN,
  rect: GuideMapPlaceShape.RECT,
  circle: GuideMapPlaceShape.CIRCLE,
};
const CONNECTOR_TYPES: Record<ConnectorType, GuideMapConnectorType> = {
  stairs: GuideMapConnectorType.STAIRS,
  escalator: GuideMapConnectorType.ESCALATOR,
  elevator: GuideMapConnectorType.ELEVATOR,
};
const CONNECTOR_DIRECTIONS: Record<
  ConnectorDirection,
  GuideMapConnectorDirection
> = {
  both: GuideMapConnectorDirection.BOTH,
  up: GuideMapConnectorDirection.UP,
  down: GuideMapConnectorDirection.DOWN,
};

const reverse = <K extends string, V extends number>(m: Record<K, V>) =>
  new Map(Object.entries(m).map(([k, v]) => [v as V, k as K]));
const SHAPE_OF = reverse(PLACE_SHAPES);
const CONNECTOR_OF = reverse(CONNECTOR_TYPES);
const DIRECTION_OF = reverse(CONNECTOR_DIRECTIONS);

const toText = (labels: LocalizedLabel | undefined) =>
  labels && Object.keys(labels).length > 0 ? { texts: labels } : undefined;
const fromText = (text: LocalizedText | undefined) =>
  text && Object.keys(text.texts).length > 0 ? text.texts : undefined;

type ObjectInit = MessageInitShape<typeof GuideMapObjectSchema>;

function toObjectKind(o: LocalizedMapObject): ObjectInit["kind"] {
  switch (o.kind) {
    case "place":
      return {
        case: "place",
        value: {
          center: { x: o.x, y: o.y },
          shape: PLACE_SHAPES[o.shape],
          width: o.w,
          height: o.h,
          pin: o.pin ?? false,
          // （旧）正方形の大きさ markerSize は、幅・高さにして保存する
          markWidth: o.markW ?? o.markerSize,
          markHeight: o.markH ?? o.markerSize,
          connector:
            o.connector && o.link
              ? {
                  type: CONNECTOR_TYPES[o.connector],
                  link: o.link,
                  direction: CONNECTOR_DIRECTIONS[o.direction ?? "both"],
                }
              : undefined,
        },
      };
    case "line":
      return {
        case: "line",
        value: { points: o.points, width: o.width, dash: o.dash },
      };
    case "area":
      return { case: "area", value: { points: o.points } };
    case "text":
      return {
        case: "text",
        value: { position: { x: o.x, y: o.y }, size: o.size },
      };
  }
}

export function toGuideMapLayoutMessage(
  layout: LocalizedGuideMapLayout,
): GuideMapLayout {
  return create(GuideMapLayoutSchema, {
    groups: layout.groups.map((g) => ({ groupId: g.groupId })),
    objects: layout.objects.map(
      (o): ObjectInit => ({
        objectId: o.id,
        groupId: o.groupId,
        title: toText(o.title),
        description: toText(o.description),
        color: o.color,
        closed: o.closed ?? false,
        pointId: o.pointId ?? "",
        routeId: o.routeId ?? "",
        kind: toObjectKind(o),
      }),
    ),
    north: layout.north,
    scale: layout.scale,
    startObjectId: layout.startId ?? "",
  });
}

function fromObject(o: GuideMapObject): LocalizedMapObject[] {
  const base = {
    id: o.objectId,
    groupId: o.groupId,
    color: o.color,
    ...(fromText(o.title) ? { title: fromText(o.title) } : {}),
    ...(fromText(o.description)
      ? { description: fromText(o.description) }
      : {}),
    ...(o.closed ? { closed: true } : {}),
    ...(o.pointId ? { pointId: o.pointId } : {}),
    ...(o.routeId ? { routeId: o.routeId } : {}),
  };
  const points = (ps: { x: number; y: number }[]) =>
    ps.map(({ x, y }) => ({ x, y }));
  switch (o.kind.case) {
    case "place": {
      const p = o.kind.value;
      const shape = SHAPE_OF.get(p.shape);
      if (!shape) return [];
      const connector = p.connector && CONNECTOR_OF.get(p.connector.type);
      return [
        {
          ...base,
          kind: "place",
          x: p.center?.x ?? 0,
          y: p.center?.y ?? 0,
          shape,
          w: p.width,
          h: p.height,
          ...(p.pin ? { pin: true } : {}),
          ...(p.markWidth !== undefined ? { markW: p.markWidth } : {}),
          ...(p.markHeight !== undefined ? { markH: p.markHeight } : {}),
          ...(connector && p.connector
            ? {
                connector,
                link: p.connector.link,
                direction: DIRECTION_OF.get(p.connector.direction) ?? "both",
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

export function fromGuideMapLayoutMessage(
  layout: GuideMapLayout | undefined,
): LocalizedGuideMapLayout {
  return {
    version: 1,
    groups: (layout?.groups ?? []).map((g) => ({ groupId: g.groupId })),
    objects: (layout?.objects ?? []).flatMap(fromObject),
    north: layout?.north ?? 0,
    scale: layout?.scale ?? 0,
    ...(layout?.startObjectId ? { startId: layout.startObjectId } : {}),
  };
}
