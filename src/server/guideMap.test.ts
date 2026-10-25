import { create } from "@bufbuild/protobuf";
import {
  GetGuideMapResponseSchema,
  GuideMapConnectorDirection,
  GuideMapConnectorType,
  GuideMapPlaceShape,
} from "@pj-hoakari/tolo-guest-client-es/tolo/guest/v1/guest_pb";
import { describe, expect, it } from "vitest";
import { fromGuideMapResponse } from "./guideMap";

describe("fromGuideMapResponse", () => {
  it("Guest Service の案内マップを、ゲスト用ページの案内マップレイアウトとグラフにする", () => {
    const res = create(GetGuideMapResponseSchema, {
      graph: {
        points: [
          { pointId: "n_4a110001", labels: { ja: "ホール", en: "Hall" } },
        ],
        groups: [{ groupId: "g_1f000001", labels: { ja: "1階" } }],
      },
      layout: {
        groups: [{ groupId: "g_1f000001" }],
        objects: [
          {
            objectId: "p-hall",
            groupId: "g_1f000001",
            color: "indigo",
            pointId: "n_4a110001",
            title: { ja: "大ホール" },
            kind: {
              case: "place",
              value: {
                center: { x: 1, y: 2 },
                shape: GuideMapPlaceShape.RECT,
                width: 30,
                height: 40,
              },
            },
          },
          {
            objectId: "c-ev",
            groupId: "g_1f000001",
            color: "indigo",
            closed: true,
            kind: {
              case: "place",
              value: {
                center: { x: 3, y: 4 },
                shape: GuideMapPlaceShape.PIN,
                pin: true,
                markWidth: 40,
                markHeight: 30,
                connector: {
                  type: GuideMapConnectorType.ELEVATOR,
                  link: "l-1",
                  direction: GuideMapConnectorDirection.UP,
                },
              },
            },
          },
          {
            objectId: "l-1",
            groupId: "g_1f000001",
            color: "slate",
            routeId: "e_4a11c001",
            kind: {
              case: "line",
              value: { points: [{ x: 0, y: 0 }], width: 4, dash: true },
            },
          },
          {
            objectId: "a-1",
            groupId: "g_1f000001",
            color: "rose",
            kind: { case: "area", value: { points: [{ x: 5, y: 6 }] } },
          },
          {
            objectId: "t-1",
            groupId: "g_1f000001",
            color: "slate",
            title: { ja: "本館1F", en: "Main building 1F" },
            description: { ja: "見出し" },
            kind: {
              case: "text",
              value: { position: { x: 7, y: 8 }, size: 22 },
            },
          },
        ],
        north: 90,
        scale: 0.05,
        startObjectId: "p-hall",
      },
      currentPointId: "n_4a110001",
    });

    expect(fromGuideMapResponse(res)).toStrictEqual({
      graph: {
        points: [
          { pointId: "n_4a110001", labels: { ja: "ホール", en: "Hall" } },
        ],
        groups: [{ groupId: "g_1f000001", labels: { ja: "1階" } }],
      },
      layout: {
        version: 1,
        groups: [{ groupId: "g_1f000001" }],
        objects: [
          {
            id: "p-hall",
            groupId: "g_1f000001",
            title: { ja: "大ホール" },
            description: undefined,
            color: "indigo",
            closed: undefined,
            pointId: "n_4a110001",
            routeId: undefined,
            kind: "place",
            x: 1,
            y: 2,
            shape: "rect",
            w: 30,
            h: 40,
            pin: undefined,
            markW: undefined,
            markH: undefined,
          },
          {
            id: "c-ev",
            groupId: "g_1f000001",
            title: undefined,
            description: undefined,
            color: "indigo",
            closed: true,
            pointId: undefined,
            routeId: undefined,
            kind: "place",
            x: 3,
            y: 4,
            shape: "pin",
            w: 0,
            h: 0,
            pin: true,
            markW: 40,
            markH: 30,
            connector: "elevator",
            link: "l-1",
            direction: "up",
          },
          {
            id: "l-1",
            groupId: "g_1f000001",
            title: undefined,
            description: undefined,
            color: "slate",
            closed: undefined,
            pointId: undefined,
            routeId: "e_4a11c001",
            kind: "line",
            points: [{ x: 0, y: 0 }],
            width: 4,
            dash: true,
          },
          {
            id: "a-1",
            groupId: "g_1f000001",
            title: undefined,
            description: undefined,
            color: "rose",
            closed: undefined,
            pointId: undefined,
            routeId: undefined,
            kind: "area",
            points: [{ x: 5, y: 6 }],
          },
          {
            id: "t-1",
            groupId: "g_1f000001",
            title: { ja: "本館1F", en: "Main building 1F" },
            description: { ja: "見出し" },
            color: "slate",
            closed: undefined,
            pointId: undefined,
            routeId: undefined,
            kind: "text",
            x: 7,
            y: 8,
            size: 22,
          },
        ],
        north: 90,
        scale: 0.05,
        startId: "p-hall",
      },
      currentPointId: "n_4a110001",
    });
  });

  it("現在地のない応答では currentPointId を持たない", () => {
    const res = create(GetGuideMapResponseSchema, { layout: {}, graph: {} });
    expect(fromGuideMapResponse(res).currentPointId).toBeUndefined();
  });
});
