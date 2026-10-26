import type {
  GraphCanvasNode,
  GraphData,
} from "@/features/tenant/management/graph/type";
import reproductions from "./graphLayoutReproductions.json";
import { sampleGuideMapGraph } from "./guest";

export const LAYOUT_FIXTURE_KEY = "tolo-layout-fixture";
export const layoutFixtureNames = [
  ...Object.keys(reproductions),
  "issue249-seed-1",
];
export const layoutSearchSeeds = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 40, 42,
  45, 46, 47, 48, 50, 52, 53, 54, 56,
];

export function layoutFixture(name: string): GraphData | undefined {
  if (name === "guide-map") return structuredClone(sampleGuideMapGraph);
  const fixed = (reproductions as Record<string, GraphData>)[name];
  if (fixed) return structuredClone(fixed);
  const match = /^issue249-seed-(\d+)$/.exec(name);
  if (!match || !layoutSearchSeeds.includes(Number(match[1]))) return undefined;
  let state = Math.imul(Number(match[1]) + 1, 2654435761) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const groupCount = 2 + Math.floor(random() * 3),
    count = 5 + Math.floor(random() * 10);
  const nodes: GraphCanvasNode[] = Array.from(
    { length: groupCount },
    (_, i) => ({
      id: `g${i}`,
      type: "graphGroup",
      position: {
        x: Math.round(random() * 1000),
        y: Math.round(random() * 1000),
      },
      width: 480,
      height: 320,
      data: { labels: { ja: `グループ ${i + 1}` } },
    }),
  );
  for (let i = 0; i < count; i++)
    nodes.push({
      id: `n${i}`,
      type: "graph",
      parentId: `g${Math.floor(random() * groupCount)}`,
      position: {
        x: Math.round(100 + random() * 600),
        y: Math.round(100 + random() * 600),
      },
      data: {
        nodeType: "GOAL_TRANSIT_MIXED",
        labels: { ja: `ポイント ${i + 1}` },
      },
    });
  const edges: GraphData["edges"] = [];
  const add = (a: number, b: number) => {
    if (a !== b)
      edges.push({
        id: `e${edges.length}`,
        type: "graph",
        source: `n${a}`,
        target: `n${b}`,
        data: { direction: random() < 0.5 ? "both" : "oneway" },
      });
  };
  for (let i = 0; i < count - 1; i++) add(i, i + 1);
  for (let i = 0; i < count; i++)
    if (random() < 0.7) add(i, Math.floor(random() * count));
  return { nodes, edges };
}
