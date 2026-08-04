import { describe, expect, it } from "vitest";
import {
  NODE_TYPE_DEFS,
  type NoticeMessageKey,
  type ValidationResult,
} from "../../nodeTypes";
import type { GraphEdgeType, GraphNodeType, NodeType } from "../../type";
import { buildNodeTypeOptions, deriveNodeTypeOption } from "./nodeTypeOptions";

const OK: ValidationResult = { ok: true };
// 制約が定義されていないため実在するキーは1つだけ。
// 理由の出し分けを検証したいので、テスト内では任意の文字列をキーとして扱う。
const NG = (messageKey: string): ValidationResult => ({
  ok: false,
  messageKey: messageKey as NoticeMessageKey,
});

/** 理由のキーをそのまま表示文言として扱う（アサーションを読みやすくするため） */
const asIs = (messageKey: NoticeMessageKey): string => messageKey;

describe("deriveNodeTypeOption: タイプ選択肢の選択可否", () => {
  it("制約を満たすタイプは選択でき、理由も出さない", () => {
    const option = deriveNodeTypeOption("GOAL", false, OK, asIs);

    expect(option).toEqual({
      type: "GOAL",
      assignable: true,
      disabledReason: null,
    });
  });

  it("制約違反のタイプは選択できず、理由を出す", () => {
    const option = deriveNodeTypeOption(
      "BOUNDARY",
      false,
      NG("接続が必要"),
      asIs,
    );

    expect(option.assignable).toBe(false);
    expect(option.disabledReason).toBe("接続が必要");
  });

  it("選択中のタイプは制約違反でも選択解除されないよう有効のまま", () => {
    const option = deriveNodeTypeOption(
      "BOUNDARY",
      true,
      NG("接続が必要"),
      asIs,
    );

    expect(option.assignable).toBe(true);
    expect(option.disabledReason).toBeNull();
  });
});

function node(id: string, nodeType: NodeType): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { label: id, nodeType },
  };
}

function edge(id: string, source: string, target: string): GraphEdgeType {
  return { id, source, target, type: "graph", data: { direction: "both" } };
}

describe("buildNodeTypeOptions: グラフ状態からの解決", () => {
  it("定義順にすべてのタイプの選択肢を返す", () => {
    const nodes = [node("a", "GOAL"), node("b", "TRANSIT_ONLY")];
    const edges = [edge("e1", "a", "b")];

    const options = buildNodeTypeOptions("a", "GOAL", nodes, edges, asIs);

    expect(options.map((o) => o.type)).toEqual(
      NODE_TYPE_DEFS.map((d) => d.type),
    );
  });

  it("選択中のタイプは常に選択可能", () => {
    const nodes = [node("a", "BOUNDARY"), node("b", "TRANSIT_ONLY")];
    const edges = [edge("e1", "a", "b")];

    const options = buildNodeTypeOptions("a", "BOUNDARY", nodes, edges, asIs);
    const selected = options.find((o) => o.type === "BOUNDARY");

    expect(selected?.assignable).toBe(true);
    expect(selected?.disabledReason).toBeNull();
  });
});
