import { describe, expect, it } from "vitest";
import type { GuideMapDoc } from "../type";
import { autoLinkGraph } from "./graphAutoLink";
import { isConnector } from "./guideMapDoc";
import { sampleGuideMapDoc } from "./guideMapIO";

// 見本から、階・場所の結び付けを全部外した地図
const unlinked = (d: GuideMapDoc): GuideMapDoc => ({
  ...d,
  floors: d.floors.map((f) => ({ ...f, groupId: undefined })),
  objects: d.objects.map((o) => ({ ...o, graphPointId: undefined })),
});

describe("グラフへの自動の結び付け", () => {
  it("見本の結び付けを外しても、階と階段・エレベーターは見本と同じ所に結び付く", async () => {
    const sample = await sampleGuideMapDoc();
    const linked = autoLinkGraph(unlinked(sample));
    expect(linked.floors.map((f) => f.groupId)).toEqual(
      sample.floors.map((f) => f.groupId),
    );
    // 見本で結び付いている物は、違うポイントには結び付かない（見本で結び付いていない部屋が、同じ名前のポイントに付くのはよい）
    const wrong = sample.objects.filter((o) => {
      const got = linked.objects.find((x) => x.id === o.id)?.graphPointId;
      return o.graphPointId && got !== undefined && got !== o.graphPointId;
    });
    expect(wrong.map((o) => o.title)).toEqual([]);
    const connectors = sample.objects.filter(
      (o) => isConnector(o) && o.graphPointId,
    );
    const missed = connectors.filter(
      (o) =>
        linked.objects.find((x) => x.id === o.id)?.graphPointId !==
        o.graphPointId,
    );
    expect(missed.map((o) => `${o.title}@${o.floor}`)).toEqual([]);
  });

  it('手で結び付きを外した物（""）は、結び付け直さない', async () => {
    const sample = await sampleGuideMapDoc();
    const target = sample.objects.find((o) => isConnector(o));
    if (!target) throw new Error("見本に階段がありません");
    const d = {
      ...sample,
      objects: sample.objects.map((o) =>
        o.id === target.id ? { ...o, graphPointId: "" } : o,
      ),
    };
    expect(
      autoLinkGraph(d).objects.find((o) => o.id === target.id)?.graphPointId,
    ).toBe("");
  });

  it("変わる所が無ければ、同じ地図をそのまま返す", async () => {
    const sample = await sampleGuideMapDoc();
    const once = autoLinkGraph(sample);
    expect(autoLinkGraph(once)).toBe(once);
  });

  it("結び付け先がグラフに無い階・物は、勝手に付け替えない（チェックで知らせる）", async () => {
    const sample = await sampleGuideMapDoc();
    const stale = {
      ...sample,
      floors: sample.floors.map((f) => ({ ...f, groupId: "g_gone" })),
      objects: sample.objects.map((o) =>
        o.graphPointId ? { ...o, graphPointId: "n_gone" } : o,
      ),
    };
    expect(autoLinkGraph(stale).floors).toBe(stale.floors);
    for (const o of stale.objects.filter((x) => x.graphPointId))
      expect(
        autoLinkGraph(stale).objects.find((x) => x.id === o.id)?.graphPointId,
      ).toBe("n_gone");
  });
});
