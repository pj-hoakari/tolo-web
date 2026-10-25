import { describe, expect, it } from "vitest";
import {
  type LocalizedGuideMapLayout,
  localizeGuideMapLayout,
} from "./guideMapLayout";

const layout: LocalizedGuideMapLayout = {
  version: 1,
  groups: [{ groupId: "g_1f000001" }],
  north: 0,
  scale: 0,
  objects: [
    {
      id: "p-hall",
      kind: "place",
      groupId: "g_1f000001",
      color: "indigo",
      shape: "rect",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      pointId: "n_4a110001",
      title: { ja: "大ホール", en: "Main hall" },
    },
    {
      id: "t-title",
      kind: "text",
      groupId: "g_1f000001",
      color: "slate",
      x: 0,
      y: 0,
      size: 22,
      title: { ja: "本館1F", en: "Main building 1F" },
      description: { ja: "見出し" },
    },
  ],
};

describe("localizeGuideMapLayout", () => {
  const pointLabels = new Map([["n_4a110001", { ja: "ホール", en: "Hall" }]]);

  it("ポイントに結び付いた部品の名前はポイントのラベルを表示言語で使う", () => {
    expect(
      localizeGuideMapLayout(layout, pointLabels, "en").objects[0].title,
    ).toBe("Hall");
  });

  it("ポイントに結び付かない部品の名前と説明は案内マップレイアウトの名前を表示言語で使い、無い言語は別の言語で補う", () => {
    const [, text] = localizeGuideMapLayout(layout, pointLabels, "en").objects;
    expect(text.title).toBe("Main building 1F");
    expect(text.description).toBe("見出し");
  });
});
