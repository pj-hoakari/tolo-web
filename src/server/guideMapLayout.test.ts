import {
  GuideMapConnectorDirection,
  GuideMapConnectorType,
  GuideMapPlaceShape,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import { describe, expect, it } from "vitest";
import type { LocalizedGuideMapLayout } from "@/features/guest/info/guideMapLayout";
import {
  fromGuideMapLayoutMessage,
  toGuideMapLayoutMessage,
} from "./guideMapLayout";

const layout: LocalizedGuideMapLayout = {
  version: 1,
  groups: [{ groupId: "g_1f000001" }, { groupId: "g_2f000001" }],
  objects: [
    {
      id: "p-hall",
      kind: "place",
      groupId: "g_1f000001",
      title: { ja: "大ホール", en: "Hall" },
      color: "exhibit",
      pointId: "n_4a110001",
      x: 10,
      y: 20,
      shape: "rect",
      w: 30,
      h: 40,
    },
    {
      id: "c-ev",
      kind: "place",
      groupId: "g_1f000001",
      color: "room",
      closed: true,
      x: 3,
      y: 4,
      shape: "pin",
      w: 0,
      h: 0,
      pin: true,
      markW: 40,
      markH: 30,
      connector: "escalator",
      link: "l-1",
      direction: "up",
    },
    {
      id: "l-1",
      kind: "line",
      groupId: "g_1f000001",
      color: "slate",
      routeId: "e_4a11c001",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      width: 4,
      dash: true,
    },
    {
      id: "a-1",
      kind: "area",
      groupId: "g_2f000001",
      color: "rest",
      description: { ja: "芝生" },
      points: [
        { x: 0, y: 0 },
        { x: 9, y: 0 },
        { x: 9, y: 9 },
      ],
    },
    {
      id: "t-1",
      kind: "text",
      groupId: "g_2f000001",
      color: "slate",
      title: { ja: "本館2F" },
      x: 7,
      y: 8,
      size: 22,
    },
  ],
  north: 90,
  scale: 0.05,
  startId: "p-hall",
};

describe("toGuideMapLayoutMessage", () => {
  it("案内マップを Graph Authoring の形にする", () => {
    const message = toGuideMapLayoutMessage(layout);
    expect(message.groups.map((g) => g.groupId)).toEqual([
      "g_1f000001",
      "g_2f000001",
    ]);
    expect(message.startObjectId).toBe("p-hall");
    const [hall, ev] = message.objects;
    expect(hall.title?.texts).toEqual({ ja: "大ホール", en: "Hall" });
    expect(hall.kind).toMatchObject({
      case: "place",
      value: {
        center: { x: 10, y: 20 },
        shape: GuideMapPlaceShape.RECT,
        width: 30,
        height: 40,
      },
    });
    expect(ev.closed).toBe(true);
    expect(ev.kind).toMatchObject({
      case: "place",
      value: {
        shape: GuideMapPlaceShape.PIN,
        pin: true,
        connector: {
          type: GuideMapConnectorType.ESCALATOR,
          link: "l-1",
          direction: GuideMapConnectorDirection.UP,
        },
      },
    });
  });

  it("階の下敷き画像は保存しない。（旧）マークの大きさは幅・高さにする", () => {
    const message = toGuideMapLayoutMessage({
      ...layout,
      groups: [
        { groupId: "g_1f000001", image: { src: "data:,", w: 10, h: 10 } },
      ],
      objects: [
        {
          id: "c-old",
          kind: "place",
          groupId: "g_1f000001",
          color: "room",
          x: 0,
          y: 0,
          shape: "pin",
          w: 0,
          h: 0,
          connector: "stairs",
          link: "l-2",
          markerSize: 36,
        },
      ],
    });
    expect(message.groups[0]).not.toHaveProperty("image");
    expect(message.objects[0].kind).toMatchObject({
      case: "place",
      value: { markWidth: 36, markHeight: 36 },
    });
  });
});

describe("fromGuideMapLayoutMessage", () => {
  it("保存した案内マップを、そのままの形で読み戻す", () => {
    expect(
      fromGuideMapLayoutMessage(toGuideMapLayoutMessage(layout)),
    ).toStrictEqual(layout);
  });

  it("まだ保存していなければ空の案内マップにする", () => {
    expect(fromGuideMapLayoutMessage(undefined)).toStrictEqual({
      version: 1,
      groups: [],
      objects: [],
      north: 0,
      scale: 0,
    });
  });
});
