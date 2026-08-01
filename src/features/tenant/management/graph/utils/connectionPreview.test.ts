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
    data: { label: id, nodeType: "GOAL" },
  };
}

describe("findConnectionPreview", () => {
  const nodes = [node("source", 0, 0), node("target", 300, 0)];

  it("ノード外40pxまでを接続候補にする", () => {
    expect(
      findConnectionPreview(
        { x: 300 - CONNECTION_PREVIEW_RADIUS, y: 28 },
        nodes,
        "source",
      )?.targetId,
    ).toBe("target");
    expect(
      findConnectionPreview(
        { x: 300 - CONNECTION_PREVIEW_RADIUS - 1, y: 28 },
        nodes,
        "source",
      ),
    ).toBeNull();
  });

  it("ノード上ではポインタの位置にかかわらず、確定後に近い辺へ接続する", () => {
    // 接続先ノードの右端上にポインタがあっても、source に近い左辺へ接続する。
    const preview = findConnectionPreview({ x: 460, y: 28 }, nodes, "source");

    expect(preview).toMatchObject({
      sourceSide: "right",
      targetSide: "left",
      sourcePosition: { x: 160, y: 28 },
      targetPosition: { x: 300, y: 28 },
    });
  });
});
