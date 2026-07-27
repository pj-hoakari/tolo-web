// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGraphSelection } from "./useGraphSelection";

describe("useGraphSelection", () => {
  it("初期状態は未選択", () => {
    const { result } = renderHook(() => useGraphSelection());

    expect(result.current.selection).toBeNull();
  });

  it("ポイント / ルートの選択は互いに上書きする", () => {
    const { result } = renderHook(() => useGraphSelection());

    act(() => result.current.selectNode("n1"));
    expect(result.current.selection).toEqual({ type: "node", id: "n1" });

    act(() => result.current.selectEdge("e1"));
    expect(result.current.selection).toEqual({ type: "edge", id: "e1" });
  });

  it("clearSelection で未選択に戻る", () => {
    const { result } = renderHook(() => useGraphSelection());

    act(() => result.current.selectNode("n1"));
    act(() => result.current.clearSelection());

    expect(result.current.selection).toBeNull();
  });

  it("clearIfSelected は選択中の要素のときだけ解除する", () => {
    const { result } = renderHook(() => useGraphSelection());

    act(() => result.current.selectNode("n1"));

    // 別の要素の削除では解除されない
    act(() => result.current.clearIfSelected("node", "n2"));
    expect(result.current.selection).toEqual({ type: "node", id: "n1" });

    // 種別違い（同じ ID のルート）でも解除されない
    act(() => result.current.clearIfSelected("edge", "n1"));
    expect(result.current.selection).toEqual({ type: "node", id: "n1" });

    act(() => result.current.clearIfSelected("node", "n1"));
    expect(result.current.selection).toBeNull();
  });
});
