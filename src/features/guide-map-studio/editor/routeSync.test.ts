// スタジオの誘導プレビューと、お客さんの画面（tolo-web）に届いた地図で、同じ道になるかを確かめる。
// お客さんの画面へは、書き出した JSON がそのまま届く場合と、tolo-web のサーバー（GetGuideMap）を通って
// 決まった項目だけが残る場合がある。どちらでも、見本の地図の全部の目的地・混雑の組み合わせで道が同じになること。
import { describe, expect, it } from "vitest";
import {
  computeFloorRoute,
  type FloorRouteResult,
} from "@/features/guest/info/guideMapFloorRoute";
import {
  type CrowdState,
  isDestination,
  type LocalizedGuideMapLayout,
  localizeGuideMapLayout,
} from "@/features/guest/info/guideMapLayout";
import sampleGraph from "@/mocks/fixtures/guideMapGraph.json";
import {
  parseGraph,
  sampleVenueDoc,
  toGuideMapLayout,
  toRouteLayout,
} from "./guideMapIO";

// tolo-web のサーバー（src/server/guideMap.ts の fromGuideMapResponse）が残す項目
const SERVER_FIELDS = [
  "id",
  "kind",
  "groupId",
  "title",
  "description",
  "color",
  "closed",
  "pointId",
  "routeId",
  "x",
  "y",
  "shape",
  "w",
  "h",
  "pin",
  "markW",
  "markH",
  "connector",
  "link",
  "direction",
  "points",
  "width",
  "dash",
  "size",
];
const throughServer = (
  layout: LocalizedGuideMapLayout,
): LocalizedGuideMapLayout => ({
  ...layout,
  objects: layout.objects.map(
    (o) =>
      Object.fromEntries(
        Object.entries(o).filter(([k]) => SERVER_FIELDS.includes(k)),
      ) as typeof o,
  ),
});

const doc = await sampleVenueDoc();
const graph = parseGraph(sampleGraph);
const pointLabels = new Map(graph.points.map((p) => [p.id, p.labels]));
const studio = toRouteLayout(doc);
// 計算結果の階は、スタジオでは階の ID、お客さんの画面ではグラフのグループ ID なので、そろえて比べる
const floorOf = new Map(doc.floors.map((f) => [f.groupId || f.id, f.id]));
const normalize = (r: FloorRouteResult) =>
  "error" in r
    ? r
    : {
        ...r,
        steps: r.steps.map((s) =>
          s.kind === "walk"
            ? { ...s, floor: floorOf.get(s.floor) ?? s.floor }
            : {
                ...s,
                fromFloor: floorOf.get(s.fromFloor) ?? s.fromFloor,
                toFloor: floorOf.get(s.toFloor) ?? s.toFloor,
              },
        ),
      };

const exported = JSON.parse(
  JSON.stringify(toGuideMapLayout(doc)),
) as LocalizedGuideMapLayout;
const start = doc.startId ?? "";
const goals = studio.objects
  .filter((o) => isDestination(o) && o.id !== start)
  .map((o) => o.id);
// 混雑なし、と、グラフに結び付いた物を1つずつ「高」「危険」にした場合
const linked = doc.objects
  .filter((o) => o.graphPointId || o.graphRouteId)
  .map((o) => o.id);
const scenarios: [string, Map<string, CrowdState>][] = [
  ["混雑なし", new Map()],
  ...linked.flatMap((id): [string, Map<string, CrowdState>][] => [
    [`${id} 高`, new Map([[id, { level: "high", danger: false }]])],
    [`${id} 危険`, new Map([[id, { level: "high", danger: true }]])],
  ]),
];

// 混雑ありの場合は、各階の最初の目的地だけ比べる（全部だと数分かかるため）
const goalOn = (id: string) => studio.objects.find((o) => o.id === id)?.groupId;
const someGoals = goals.filter(
  (g, i) => goals.findIndex((x) => goalOn(x) === goalOn(g)) === i,
);
const goalsOf = (i: number) => (i === 0 ? goals : someGoals);
// スタジオの誘導プレビューの道（混雑の場合ごと・目的地ごと）
const want = scenarios.map(([, crowd], i) =>
  goalsOf(i).map((goal) => computeFloorRoute(studio, start, goal, { crowd })),
);

describe("誘導プレビューとお客さんの画面で同じ道になる", () => {
  it("見本に目的地とグラフの結び付きがあり、混雑を避けて道が変わる場合がある", () => {
    expect(goals.length).toBeGreaterThan(30);
    expect(linked.length).toBeGreaterThan(40);
    const plain = JSON.stringify(
      someGoals.map((goal) => want[0][goals.indexOf(goal)]),
    );
    expect(want.slice(1).some((w) => JSON.stringify(w) !== plain)).toBe(true);
  });
  for (const [name, toGuest] of [
    ["書き出した JSON をそのまま読む", (l: LocalizedGuideMapLayout) => l],
    ["tolo-web のサーバーを通す", throughServer],
  ] as const) {
    it(name, () => {
      const guest = localizeGuideMapLayout(
        toGuest(exported),
        pointLabels,
        "ja",
      );
      const got = scenarios.map(([, crowd], i) =>
        goalsOf(i).map((goal) =>
          normalize(computeFloorRoute(guest, start, goal, { crowd })),
        ),
      );
      expect(got).toEqual(want);
    }, 120_000);
  }
});
