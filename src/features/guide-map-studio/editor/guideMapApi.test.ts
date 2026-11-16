import { describe, expect, it } from "vitest";
import { orpc } from "@/lib/orpc";
import { createOrpcHandlers } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import {
  fromGuideMapLayoutMessage,
  toGuideMapLayoutMessage,
} from "@/server/guideMapLayout";
import {
  GuideMapSaveError,
  guideMapFingerprint,
  loadGuideMap,
  saveGuideMap,
} from "./guideMapApi";
import { fromGuideMapLayout, toGuideMapLayout } from "./guideMapIO";
import { emptyDoc, type VenueMapDoc } from "./venueMap";

const doc: VenueMapDoc = {
  ...emptyDoc(),
  floors: [{ id: "f1", name: "1F", groupId: "g_1f000001" }],
  activeFloorId: "f1",
  objects: [
    {
      id: "p-hall",
      kind: "place",
      floor: "f1",
      title: "大ホール",
      color: "exhibit",
      graphPointId: "n_4a110001",
      shape: "rect",
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    },
  ],
};

describe("saveGuideMap / loadGuideMap", () => {
  it("まだ保存していなければ null", async () => {
    expect(await loadGuideMap("e")).toBeNull();
  });

  it("保存した地図を読み戻し、階の名前はグラフのグループ名にする", async () => {
    server.use(
      ...createOrpcHandlers({
        savedGuideMap: {
          layout: {
            version: 1,
            groups: [],
            objects: [],
            north: 0,
            scale: 0,
          },
          groupLabels: { g_1f000001: { ja: "1階", en: "Floor 1" } },
        },
      }),
    );

    await saveGuideMap("e", doc);
    const loaded = await loadGuideMap("e");

    expect(loaded?.floors).toEqual([
      { id: "g_1f000001", groupId: "g_1f000001", name: "1階" },
    ]);
    expect(loaded?.objects).toEqual([
      expect.objectContaining({
        id: "p-hall",
        kind: "place",
        floor: "g_1f000001",
        title: "大ホール",
        graphPointId: "n_4a110001",
      }),
    ]);
  });

  it("サーバーが持たない階の画像・写真は送らない", async () => {
    await saveGuideMap("e", {
      ...doc,
      floors: [
        {
          ...doc.floors[0],
          image: { src: "data:image/png;base64,AAAA", w: 10, h: 10 },
        },
      ],
      objects: doc.objects.map((o) => ({ ...o, photo: "data:,photo" })),
    });
    const { layout } = await orpc.graph.getGuideMapLayout({ eventId: "e" });
    expect(layout.groups).toEqual([{ groupId: "g_1f000001" }]);
    expect(layout.objects[0]).not.toHaveProperty("photo");
  });

  it.each([
    ["BAD_REQUEST", "rejected"],
    ["FORBIDDEN", "forbidden"],
  ] as const)(
    "保存を %s で断られたら、理由 %s のエラーにする",
    async (code, reason) => {
      server.use(...createOrpcHandlers({ saveGuideMapLayoutError: code }));
      const error = await saveGuideMap("e", doc).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(GuideMapSaveError);
      expect(error).toMatchObject({ reason });
    },
  );

  it("それ以外の失敗はそのまま投げる", async () => {
    server.use(
      ...createOrpcHandlers({
        saveGuideMapLayoutError: "INTERNAL_SERVER_ERROR",
      }),
    );
    const error = await saveGuideMap("e", doc).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(GuideMapSaveError);
  });
});

describe("guideMapFingerprint", () => {
  const connectorDoc: VenueMapDoc = {
    ...doc,
    floors: [
      {
        ...doc.floors[0],
        image: { src: "data:image/png;base64,AAAA", w: 10, h: 10 },
      },
    ],
    objects: [
      ...doc.objects,
      {
        id: "c-1",
        kind: "place",
        floor: "f1",
        color: "room",
        shape: "pin",
        x: 1,
        y: 2,
        w: 0,
        h: 0,
        pin: false,
        connector: "stairs",
        link: "l-1",
      },
    ],
  };

  it("保存して読み戻した地図は、保存した地図と同じ指紋になる", () => {
    const stored = fromGuideMapLayoutMessage(
      toGuideMapLayoutMessage(toGuideMapLayout(connectorDoc)),
    );
    expect(guideMapFingerprint(fromGuideMapLayout(stored))).toBe(
      guideMapFingerprint(connectorDoc),
    );
  });

  it("地図を変えると指紋が変わる", () => {
    const moved = {
      ...doc,
      objects: doc.objects.map((o) => ({ ...o, x: 11 })),
    } as VenueMapDoc;
    expect(guideMapFingerprint(moved)).not.toBe(guideMapFingerprint(doc));
  });
});
