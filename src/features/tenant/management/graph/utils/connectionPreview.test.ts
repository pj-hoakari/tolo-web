import { describe, expect, it } from "vitest";
import type { GraphNodeType } from "../type";
import {
  CONNECTION_PREVIEW_RADIUS,
  findConnectionPreview,
} from "./connectionPreview";

function node(id: string, x: number, y: number): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    data: { labels: { ja: id }, nodeType: "GOAL" },
  };
}

describe("findConnectionPreview", () => {
  // position はノード中心。想定サイズ 160x56 なので
  // source の範囲は x:-80..80 / target の範囲は x:220..380（y はどちらも -28..28）
  const nodes = [node("source", 0, 0), node("target", 300, 0)];

  it("ノード外40pxまでを接続候補にする", () => {
    expect(
      findConnectionPreview(
        { x: 220 - CONNECTION_PREVIEW_RADIUS, y: 0 },
        nodes,
        "source",
      )?.targetId,
    ).toBe("target");
    expect(
      findConnectionPreview(
        { x: 220 - CONNECTION_PREVIEW_RADIUS - 1, y: 0 },
        nodes,
        "source",
      ),
    ).toBeNull();
  });

  it("ノード上ではポインタの位置にかかわらず、確定後に近い辺へ接続する", () => {
    // 接続先ノードの右端付近にポインタがあっても、source に近い左辺へ接続する。
    const preview = findConnectionPreview({ x: 370, y: 0 }, nodes, "source");

    expect(preview).toMatchObject({
      sourceSide: "right",
      targetSide: "left",
      sourcePosition: { x: 80, y: 0 },
      targetPosition: { x: 220, y: 0 },
    });
  });
});
