import { describe, expect, it } from "vitest";
import type { NoticeMessageKey, ValidationResult } from "../../nodeTypes";
import type { GraphEdgeType, GraphNodeType, NodeType } from "../../type";
import {
  deriveEdgeDirectionState,
  resolveEdgeDirectionState,
} from "./edgeDirectionState";

const OK: ValidationResult = { ok: true };
// 制約が定義されていないため実在するキーは1つだけ。
// 理由の出し分けを検証したいので、テスト内では任意の文字列をキーとして扱う。
const NG = (messageKey: string): ValidationResult => ({
  ok: false,
  messageKey: messageKey as NoticeMessageKey,
});

/** 理由のキーをそのまま表示文言として扱う（アサーションを読みやすくするため） */
const asIs = (messageKey: NoticeMessageKey): string => messageKey;

describe("deriveEdgeDirectionState: 方向トグルの操作可否", () => {
  it("すべての検証を通れば両方の方向が選択でき、理由も出さない", () => {
    const state = deriveEdgeDirectionState("both", OK, OK, OK, asIs);

    expect(state.bothDisabled).toBe(false);
    expect(state.onewayDisabled).toBe(false);
    expect(state.directionReason).toBeNull();
  });

  it("選択中の方向は制約違反でも選択解除されないよう有効のまま", () => {
    const state = deriveEdgeDirectionState(
      "both",
      NG("両通行は不可"),
      OK,
      OK,
      asIs,
    );

    expect(state.bothDisabled).toBe(false);
    expect(state.directionReason).toBe("両通行は不可");
  });

  it("選択していない方向が制約違反なら無効化して理由を出す", () => {
    const state = deriveEdgeDirectionState(
      "both",
      OK,
      NG("片方向は不可"),
      OK,
      asIs,
    );

    expect(state.onewayDisabled).toBe(true);
    expect(state.directionReason).toBe("片方向は不可");
  });

  it("両方が制約違反なら両通行側の理由を優先して出す", () => {
    const state = deriveEdgeDirectionState(
      "oneway",
      NG("両通行は不可"),
      NG("片方向は不可"),
      OK,
      asIs,
    );

    expect(state.bothDisabled).toBe(true);
    expect(state.onewayDisabled).toBe(false);
    expect(state.directionReason).toBe("両通行は不可");
  });
});

describe("deriveEdgeDirectionState: 反転操作の可否", () => {
  it("両通行のルートは向きの概念が無いため反転できず、理由も出さない", () => {
    const state = deriveEdgeDirectionState(
      "both",
      OK,
      OK,
      NG("反転は不可"),
      asIs,
    );

    expect(state.reverseDisabled).toBe(true);
    expect(state.reverseReason).toBeNull();
  });

  it("片方向で反転が制約違反なら無効化して理由を出す", () => {
    const state = deriveEdgeDirectionState(
      "oneway",
      OK,
      OK,
      NG("反転は不可"),
      asIs,
    );

    expect(state.reverseDisabled).toBe(true);
    expect(state.reverseReason).toBe("反転は不可");
  });

  it("片方向で反転できるなら有効", () => {
    const state = deriveEdgeDirectionState("oneway", OK, OK, OK, asIs);

    expect(state.reverseDisabled).toBe(false);
    expect(state.reverseReason).toBeNull();
  });
});

function node(id: string, nodeType: NodeType): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x: 0, y: 0 },
    data: { labels: { ja: id }, nodeType },
  };
}

describe("resolveEdgeDirectionState: グラフ状態からの解決", () => {
  const nodes = [node("a", "BOUNDARY"), node("b", "TRANSIT_ONLY")];

  it("エッジの方向をそのまま反映する", () => {
    const edge: GraphEdgeType = {
      id: "e1",
      source: "a",
      target: "b",
      type: "graph",
      data: { direction: "oneway" },
    };

    expect(resolveEdgeDirectionState(edge, nodes, [edge], asIs).direction).toBe(
      "oneway",
    );
  });

  it("data が無いエッジは両通行として扱う", () => {
    const edge = {
      id: "e1",
      source: "a",
      target: "b",
      type: "graph",
    } as GraphEdgeType;

    expect(resolveEdgeDirectionState(edge, nodes, [edge], asIs).direction).toBe(
      "both",
    );
  });
});
