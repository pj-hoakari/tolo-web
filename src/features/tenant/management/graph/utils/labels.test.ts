import { describe, expect, it } from "vitest";
import type { GraphCanvasNode, GraphNodeType } from "../type";
import { isPointNode } from "../type";
import {
  compactLabels,
  countLabeledNodes,
  deriveNodeLabels,
  resolveLabel,
} from "./labels";

function node(id: string, labels: Record<string, string>): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { labels, nodeType: "GOAL" },
  };
}

function group(id: string, labels: Record<string, string>): GraphCanvasNode {
  return {
    id,
    type: "graphGroup",
    position: { x: 0, y: 0 },
    data: { labels },
  };
}

describe("resolveLabel", () => {
  it("表示言語のラベルをそのまま返す", () => {
    expect(resolveLabel({ ja: "入口", en: "Entrance" }, "en")).toEqual({
      text: "Entrance",
      isFallback: false,
    });
  });

  it("表示言語に無ければ対応ロケール順でフォールバックする", () => {
    // 対応ロケール順（ja が先頭）に従い、キーの記述順には依存しない
    expect(resolveLabel({ en: "Entrance", ja: "入口" }, "ko")).toEqual({
      text: "入口",
      isFallback: true,
    });
  });

  it("対応ロケール外のキーしか無い場合もフォールバックする", () => {
    expect(resolveLabel({ fr: "Entrée" }, "ja")).toEqual({
      text: "Entrée",
      isFallback: true,
    });
  });

  it("空文字のラベルは未設定として扱う", () => {
    expect(resolveLabel({ en: "", ja: "入口" }, "en")).toEqual({
      text: "入口",
      isFallback: true,
    });
  });

  it("ラベルがひとつも無ければ空文字を返す", () => {
    expect(resolveLabel({}, "ja")).toEqual({ text: "", isFallback: false });
  });
});

describe("deriveNodeLabels", () => {
  it("ポイントに表示言語で解決したラベルを注入する", () => {
    const nodes: GraphCanvasNode[] = [
      node("n1", { ja: "入口", en: "Entrance" }),
      node("n2", { ja: "出口" }),
    ];

    const derived = deriveNodeLabels(nodes, "en");

    expect(derived.map((n) => n.data.label)).toEqual(["Entrance", "出口"]);
    expect(
      derived.map((n) => isPointNode(n) && n.data.labelIsFallback),
    ).toEqual([false, true]);
    // 元の配列は書き換えない
    expect(nodes[0].data.label).toBeUndefined();
  });

  it("グループにも表示言語で解決したラベルを注入する", () => {
    const nodes: GraphCanvasNode[] = [
      group("g1", { ja: "1F", en: "Floor 1" }),
      group("g2", { ja: "2F" }),
    ];

    const derived = deriveNodeLabels(nodes, "en");

    expect(derived.map((n) => n.data.label)).toEqual(["Floor 1", "2F"]);
    expect(derived.map((n) => n.data.labelIsFallback)).toEqual([false, true]);
    // 元の配列は書き換えない
    expect(nodes[0].data.label).toBeUndefined();
  });
});

describe("countLabeledNodes", () => {
  it("ロケールごとのラベル設定済みポイント・グループ数を数える", () => {
    const nodes: GraphCanvasNode[] = [
      node("n1", { ja: "入口", en: "Entrance" }),
      node("n2", { ja: "出口", en: "" }),
      group("g1", { ja: "1F" }),
    ];

    expect(countLabeledNodes(nodes)).toEqual({ ja: 3, en: 1 });
  });
});

describe("compactLabels", () => {
  it("空文字のエントリを除く", () => {
    expect(compactLabels({ ja: "入口", en: "" })).toEqual({ ja: "入口" });
  });
});
