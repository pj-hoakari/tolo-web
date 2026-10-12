import { describe, expect, it } from "vitest";
import type { NoticeMessageKey } from "../../nodeTypes";
import type { GraphEdgeType, GraphNodeType, NodeType } from "../../type";
import { buildNodeTypeOptions } from "./nodeTypeOptions";

const asIs = (messageKey: NoticeMessageKey): string => messageKey;

function node(id: string, nodeType: NodeType): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { labels: { ja: id }, nodeType },
  };
}

function edge(id: string, source: string, target: string): GraphEdgeType {
  return { id, source, target, type: "graph", data: { direction: "both" } };
}

function optionsFor(type: NodeType) {
  const nodes = [node("a", type), node("b", "TRANSIT_ONLY")];
  const edges = [edge("e1", "a", "b")];
  return buildNodeTypeOptions("a", type, nodes, edges, asIs).map(
    ({ flag, checked, next, assignable }) => ({
      flag,
      checked,
      next,
      assignable,
    }),
  );
}

describe("buildNodeTypeOptions: タイプをフラグとして切り替える", () => {
  it("停滞可のポイントは、停滞を外すと通過のみ、目的地にすると目的地になる", () => {
    expect(optionsFor("GOAL_TRANSIT_MIXED")).toEqual([
      { flag: "dwell", checked: true, next: "TRANSIT_ONLY", assignable: true },
      { flag: "destination", checked: false, next: "GOAL", assignable: true },
    ]);
  });

  it("通過のみのポイントは、停滞を許すと停滞可になり、目的地は選べない", () => {
    expect(optionsFor("TRANSIT_ONLY")).toEqual([
      {
        flag: "dwell",
        checked: false,
        next: "GOAL_TRANSIT_MIXED",
        assignable: true,
      },
      {
        flag: "destination",
        checked: false,
        next: "GOAL",
        assignable: false,
      },
    ]);
  });

  it("目的地のポイントは両方のフラグが立ち、目的地を外すと停滞可に戻る", () => {
    expect(optionsFor("GOAL")).toEqual([
      { flag: "dwell", checked: true, next: "TRANSIT_ONLY", assignable: true },
      {
        flag: "destination",
        checked: true,
        next: "GOAL_TRANSIT_MIXED",
        assignable: true,
      },
    ]);
  });
});
