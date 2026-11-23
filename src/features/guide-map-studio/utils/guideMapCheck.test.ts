import { describe, expect, it } from "vitest";
import {
  checkGuideMapDoc,
  checkIssueKey,
  shapesOverlap,
} from "./guideMapCheck";
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
        level: "warn",
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

describe("重なりのチェック", () => {
  const rect = (cx: number, cy: number, w: number, h: number) => ({
    round: false,
    cx,
    cy,
    rx: w / 2,
    ry: h / 2,
  });
  const circle = (cx: number, cy: number, d: number) => ({
    round: true,
    cx,
    cy,
    rx: d / 2,
    ry: d / 2,
  });

  it("四角どうし：重なっていれば知らせ、となり合わせ（縁がふれるだけ）は知らせない", () => {
    expect(shapesOverlap(rect(0, 0, 100, 100), rect(80, 0, 100, 100))).toBe(
      true,
    );
    expect(shapesOverlap(rect(0, 0, 100, 100), rect(100, 0, 100, 100))).toBe(
      false,
    );
  });

  it("丸は、外側の四角の角だけが重なっているときは知らせない", () => {
    // 丸の右下の角あたりに四角を置く（外側の四角どうしは重なるが、丸には届かない）
    expect(shapesOverlap(circle(0, 0, 100), rect(48, 48, 20, 20))).toBe(false);
    expect(shapesOverlap(circle(0, 0, 100), rect(40, 0, 40, 40))).toBe(true);
    expect(shapesOverlap(circle(0, 0, 100), circle(70, 70, 100))).toBe(false);
    expect(shapesOverlap(circle(0, 0, 100), circle(60, 0, 100))).toBe(true);
  });

  it("階段・エレベーター（ピン）と部屋が重なっていれば「確認してください」で知らせる", async () => {
    const doc = await sampleGuideMapDoc();
    const room = doc.objects.find(
      (o) => o.kind === "place" && o.shape === "rect" && !isConnector(o),
    );
    const stairs = doc.objects.find(
      (o) => isConnector(o) && o.shape === "pin" && o.floor === room?.floor,
    );
    if (room?.kind !== "place" || stairs?.kind !== "place")
      throw new Error("見本に部屋と階段がありません");
    const issues = checkGuideMapDoc(
      {
        ...doc,
        objects: doc.objects.map((o) =>
          o.id === stairs.id ? { ...o, x: room.x, y: room.y } : o,
        ),
      },
      "（無題）",
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        kind: "overlap",
        level: "warn",
      }),
    );
    expect(
      issues.some(
        (is) =>
          is.kind === "overlap" &&
          [is.objectId, is.otherId].includes(stairs.id) &&
          [is.objectId, is.otherId].includes(room.id),
      ),
    ).toBe(true);
  });

  it("項目の鍵は、名前が変わっても同じ", () => {
    const base = {
      kind: "overlap" as const,
      level: "warn" as const,
      floorId: "f1",
      objectId: "a",
      otherId: "b",
    };
    expect(checkIssueKey({ ...base, vars: { a: "受付" } })).toBe(
      checkIssueKey({ ...base, vars: { a: "総合受付" } }),
    );
  });
});
