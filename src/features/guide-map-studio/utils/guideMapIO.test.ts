import { describe, expect, it } from "vitest";
import { emptyDoc } from "./guideMapDoc";
import {
  fromGuideMapLayout,
  sampleGuideMapDoc,
  toGuideMapLayout,
} from "./guideMapIO";

describe("toGuideMapLayout", () => {
  it("スタジオだけで使う名前の大きさ（labelScale）は、書き出す案内マップに入れない", () => {
    const doc = emptyDoc();
    const layout = toGuideMapLayout({
      ...doc,
      objects: [
        {
          id: "p1",
          kind: "place",
          floor: doc.activeFloorId,
          title: "403",
          color: "room",
          shape: "rect",
          x: 100,
          y: 100,
          w: 160,
          h: 180,
          labelScale: 1.5,
        },
      ],
    });
    expect(layout.objects[0]).not.toHaveProperty("labelScale");
    expect(layout.objects[0]).toMatchObject({ id: "p1", w: 160, h: 180 });
  });
});

describe("範囲の名前", () => {
  it("書き出し・保存には入れず、読み込むときも外す", async () => {
    const sample = await sampleGuideMapDoc();
    const area = sample.objects.find((o) => o.kind === "area");
    if (!area) throw new Error("見本に範囲がありません");
    const named = {
      ...sample,
      objects: sample.objects.map((o) =>
        o.id === area.id ? { ...o, title: "本館" } : o,
      ),
    };
    const layout = toGuideMapLayout(named);
    expect(layout.objects.find((o) => o.id === area.id)?.title).toBeUndefined();
    // 名前が付いたまま保存された地図を読み込んでも、範囲の名前は外れる
    const saved = {
      ...layout,
      objects: layout.objects.map((o) =>
        o.id === area.id ? { ...o, title: { ja: "本館" } } : o,
      ),
    };
    expect(
      fromGuideMapLayout(saved).objects.find((o) => o.id === area.id)?.title,
    ).toBeUndefined();
  });
});
