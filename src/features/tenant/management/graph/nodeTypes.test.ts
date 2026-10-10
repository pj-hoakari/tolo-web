import { describe, expect, it } from "vitest";
import {
  collectNodeNotices,
  deriveNodeNotices,
  resolveConnectionDirection,
} from "./nodeTypes";
import type {
  EdgeDirection,
  GraphCanvasNode,
  GraphEdgeType,
  GraphNodeType,
  NodeType,
} from "./type";
import { isPointNode } from "./type";

function node(id: string, nodeType: NodeType): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { labels: { ja: id }, nodeType },
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  direction: EdgeDirection,
): GraphEdgeType {
  return { id, source, target, type: "graph", data: { direction } };
}

/** ポイントの data を取り出す（グループには存在しないフィールドの検証用） */
function pointDataOf(node: GraphCanvasNode | undefined) {
  return node && isPointNode(node) ? node.data : undefined;
}

describe("collectNodeNotices: 入退出点とクローズドモード", () => {
  it("外部ポイントと接続したポイントは入退出点の通知が付く", () => {
    const nodes = [node("x", "EXTERNAL"), node("g", "GOAL")];
    const edges = [edge("e1", "x", "g", "oneway")];

    const notices = collectNodeNotices("g", nodes, edges);
    expect(notices).toEqual([{ level: "info", messageKey: "boundary" }]);
  });

  it("外部ポイント以外とだけ接続したポイントは通知が付かない", () => {
    const nodes = [
      node("x", "EXTERNAL"),
      node("g", "GOAL"),
      node("h", "TRANSIT_ONLY"),
    ];
    const edges = [edge("e1", "x", "h", "both"), edge("e2", "g", "h", "both")];

    expect(collectNodeNotices("g", nodes, edges)).toHaveLength(0);
  });

  it("どこにも接続していない外部ポイントはクローズドモードの通知が付く", () => {
    const nodes = [node("x", "EXTERNAL"), node("g", "GOAL")];

    expect(collectNodeNotices("x", nodes, [])).toEqual([
      { level: "info", messageKey: "closed" },
    ]);
  });

  it("接続のある外部ポイントはクローズドモードの通知が付かない", () => {
    const nodes = [node("x", "EXTERNAL"), node("g", "GOAL")];
    const edges = [edge("e1", "g", "x", "oneway")];

    expect(collectNodeNotices("x", nodes, edges)).toHaveLength(0);
  });
});

describe("deriveNodeNotices: 派生情報の注入", () => {
  it("通知対象ノードのデータにのみ notices を注入する", () => {
    const nodes = [
      node("x", "EXTERNAL"),
      node("b", "GOAL"),
      node("h", "TRANSIT_ONLY"),
    ];
    const edges = [edge("e1", "x", "b", "both"), edge("e2", "b", "h", "both")];

    const derived = deriveNodeNotices(nodes, edges);
    const boundary = derived.find((n) => n.id === "b");
    const transit = derived.find((n) => n.id === "h");

    expect(pointDataOf(boundary)?.notices).toHaveLength(1);
    expect(pointDataOf(transit)?.notices).toBeUndefined();
  });
});

describe("resolveConnectionDirection: 外部ポイントとの接続", () => {
  it("外部ポイントとポイントを両通行で接続できる", () => {
    const nodes = [node("x", "EXTERNAL"), node("g", "GOAL")];

    expect(resolveConnectionDirection("x", "g", nodes, [])).toBe("both");
  });
});
