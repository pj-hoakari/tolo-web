// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useEasyConnect } from "./useEasyConnect";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

function renderEasyConnect() {
  const wrapperRef = createRef<HTMLDivElement>();
  return renderHook(() => useEasyConnect(wrapperRef), { wrapper });
}

afterEach(cleanup);

describe("useEasyConnect", () => {
  it("初期状態ではモードが無効", () => {
    const { result } = renderEasyConnect();
    expect(result.current.mode).toBeNull();
    expect(result.current.active).toBe(false);
  });

  it("startGlobal でグローバルモードを開始し、end で終了する", () => {
    const { result } = renderEasyConnect();

    act(() => result.current.startGlobal());
    expect(result.current.mode).toEqual({ kind: "global" });
    expect(result.current.active).toBe(true);

    act(() => result.current.end());
    expect(result.current.mode).toBeNull();
  });

  it("startFromNode で始点固定モードを開始する", () => {
    const { result } = renderEasyConnect();

    act(() => result.current.startFromNode("n1", { x: 100, y: 200 }));
    expect(result.current.mode).toEqual({
      kind: "from-node",
      sourceNodeId: "n1",
      origin: { x: 100, y: 200 },
    });
  });

  it("Escape キーでモードをキャンセルする", () => {
    const { result } = renderEasyConnect();

    act(() => result.current.startGlobal());
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.mode).toBeNull();
  });

  it("モードが無効な間は Escape キーを監視しない", () => {
    const { result } = renderEasyConnect();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.mode).toBeNull();

    // モード再開後も通常どおり動作する
    act(() => result.current.startFromNode("n1", { x: 0, y: 0 }));
    expect(result.current.active).toBe(true);
  });
});
