import { describe, expect, it } from "vitest";
import { checkGuideMapDoc } from "./guideMapCheck";
import { isConnector } from "./guideMapDoc";
import { sampleGuideMapDoc } from "./guideMapIO";

const kinds = (issues: ReturnType<typeof checkGuideMapDoc>) =>
  issues.map((is) => is.kind);

describe("誘導グラフとの結び付けのチェック", () => {
  it("見本は、部屋がグラフに無くても結び付けの注意を出さない", async () => {
    const doc = await sampleGuideMapDoc();
    expect(doc.objects.some((o) => o.kind === "place" && !o.graphPointId)).toBe(
      true,
    );
    expect(kinds(checkGuideMapDoc(doc, "（無題）"))).not.toContain(
      "connector-no-point",
    );
  });

  it("グラフに結び付いていない階段・エレベーターを知らせる", async () => {
    const doc = await sampleGuideMapDoc();
    const target = doc.objects.find(isConnector);
    if (!target) throw new Error("見本に階段・エレベーターがありません");
    const issues = checkGuideMapDoc(
      {
        ...doc,
        objects: doc.objects.map((o) =>
          o.id === target.id ? { ...o, graphPointId: undefined } : o,
        ),
      },
      "（無題）",
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "connector-no-point",
        level: "info",
        objectId: target.id,
      }),
    );
  });

  it("グラフを読み込んでいなければ、結び付けの注意は出さない", async () => {
    const doc = await sampleGuideMapDoc();
    const issues = checkGuideMapDoc(
      {
        ...doc,
        graph: undefined,
        objects: doc.objects.map((o) => ({ ...o, graphPointId: undefined })),
      },
      "（無題）",
    );
    expect(kinds(issues)).not.toContain("connector-no-point");
  });
});
