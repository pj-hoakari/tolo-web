import { describe, expect, it } from "vitest";
import { emptyDoc } from "./guideMapDoc";
import { toGuideMapLayout } from "./guideMapIO";

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
