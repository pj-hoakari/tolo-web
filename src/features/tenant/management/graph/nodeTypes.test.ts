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
    data: { label: id, nodeType },
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

describe("collectNodeNotices: 入退出点の強調", () => {
  it("両通行ルートに接続した入退出点は入退出両方の通知が付く", () => {
    const nodes = [node("b", "BOUNDARY"), node("h", "TRANSIT_ONLY")];
    const edges = [edge("e1", "b", "h", "both")];

    const notices = collectNodeNotices("b", nodes, edges);
    expect(notices).toHaveLength(1);
    expect(notices[0].level).toBe("info");
    expect(notices[0].messageKey).toBe("dualDirection");
  });

  it("片方向ルートのみ（出力のみ）の入退出点は通知が付かない", () => {
    const nodes = [node("b", "BOUNDARY"), node("h", "TRANSIT_ONLY")];
    const edges = [edge("e1", "b", "h", "oneway")];

    expect(collectNodeNotices("b", nodes, edges)).toHaveLength(0);
  });

  it("入力と出力の片方向ルートを両方持つ入退出点は通知が付く", () => {
    const nodes = [
      node("b", "BOUNDARY"),
      node("in", "TRANSIT_ONLY"),
      node("out", "TRANSIT_ONLY"),
    ];
    // in→b（bは入力）, b→out（bは出力）
    const edges = [
      edge("e1", "in", "b", "oneway"),
      edge("e2", "b", "out", "oneway"),
    ];

    expect(collectNodeNotices("b", nodes, edges)).toHaveLength(1);
  });

  it("入退出点以外は両通行でも通知が付かない", () => {
    const nodes = [node("g", "GOAL"), node("h", "TRANSIT_ONLY")];
    const edges = [edge("e1", "g", "h", "both")];

    expect(collectNodeNotices("g", nodes, edges)).toHaveLength(0);
  });
});

describe("deriveNodeNotices: 派生情報の注入", () => {
  it("通知対象ノードのデータにのみ notices を注入する", () => {
    const nodes = [node("b", "BOUNDARY"), node("h", "TRANSIT_ONLY")];
    const edges = [edge("e1", "b", "h", "both")];

    const derived = deriveNodeNotices(nodes, edges);
    const boundary = derived.find((n) => n.id === "b");
    const transit = derived.find((n) => n.id === "h");

    expect(pointDataOf(boundary)?.notices).toHaveLength(1);
    expect(pointDataOf(transit)?.notices).toBeUndefined();
  });
});

describe("resolveConnectionDirection: 入退出点の入出力制約を撤廃", () => {
  it("入退出点どうしを両通行で接続できる", () => {
    const nodes = [node("a", "BOUNDARY"), node("b", "BOUNDARY")];

    expect(resolveConnectionDirection("a", "b", nodes, [])).toBe("both");
  });
});
