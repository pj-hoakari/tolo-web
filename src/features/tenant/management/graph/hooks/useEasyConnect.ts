"use client";

import { useStoreApi, type XYPosition } from "@xyflow/react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { GraphCanvasNode, GraphEdgeType } from "../type";
import {
  EASY_CONNECT_HANDLE_ID,
  type EasyConnectMode,
} from "../utils/easyConnect";

export type EasyConnectApi = {
  mode: EasyConnectMode | null;
  active: boolean;
  /** すべてのノードを始点にできるルート追加モードを開始する */
  startGlobal: () => void;
  /** 始点を固定したルート追加モードを開始する（origin はスクリーン座標） */
  startFromNode: (sourceNodeId: string, origin: XYPosition) => void;
  /** モードを終了し、進行中の接続ドラッグも破棄する */
  end: () => void;
};

/**
 * ルート追加モードの状態管理と、モードに付随する入力制御を担うフック。
 * - Esc キーでのキャンセル
 * - 始点固定モードでの接続ドラッグ自動開始（ユーザーは終点を選ぶだけでよい）
 * 呼び出し側で ReactFlowProvider の内側に置くこと。
 */
export function useEasyConnect(
  wrapperRef: RefObject<HTMLDivElement | null>,
): EasyConnectApi {
  const storeApi = useStoreApi<GraphCanvasNode, GraphEdgeType>();
  const [mode, setMode] = useState<EasyConnectMode | null>(null);
  const active = mode !== null;

  const end = useCallback(() => {
    setMode(null);
    // 進行中の接続ドラッグが残っていた場合も、接続線ごと破棄する。
    storeApi.getState().cancelConnection();
  }, [storeApi]);

  const startGlobal = useCallback(() => {
    setMode({ kind: "global" });
  }, []);

  const startFromNode = useCallback(
    (sourceNodeId: string, origin: XYPosition) => {
      setMode({ kind: "from-node", sourceNodeId, origin });
    },
    [],
  );

  // Esc キーでモードをキャンセルする。
  useEffect(() => {
    if (!active) return;

    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") end();
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [active, end]);

  // 始点固定モードでは、始点ノードからの接続ドラッグを自動で開始する。
  // これによりユーザーは終点のノードをクリックするだけでルートを作成できる。
  useEffect(() => {
    if (mode?.kind !== "from-node") return;

    const { sourceNodeId, origin } = mode;
    let rafId = 0;
    let attempts = 0;
    const startConnectionDrag = () => {
      const node = storeApi.getState().nodeLookup.get(sourceNodeId);
      const handleRegistered = node?.internals.handleBounds?.source?.some(
        (handle) => handle.id === EASY_CONNECT_HANDLE_ID,
      );
      const handleElement = wrapperRef.current?.querySelector<HTMLElement>(
        `.react-flow__handle[data-handleid="${EASY_CONNECT_HANDLE_ID}"][data-nodeid="${CSS.escape(sourceNodeId)}"]`,
      );
      if (!handleRegistered || !handleElement) {
        // updateNodeInternals は rAF 遅延のため、ハンドル登録を待って再試行する。
        if (attempts < 10) {
          attempts += 1;
          rafId = requestAnimationFrame(startConnectionDrag);
        }
        return;
      }
      handleElement.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: origin.x,
          clientY: origin.y,
        }),
      );
      // ドラッグ閾値を越えさせて、マウスを動かす前から接続線を表示する。
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: origin.x + 2,
          clientY: origin.y + 2,
        }),
      );
    };
    rafId = requestAnimationFrame(startConnectionDrag);
    return () => cancelAnimationFrame(rafId);
  }, [mode, storeApi, wrapperRef]);

  return useMemo(
    () => ({ mode, active: mode !== null, startGlobal, startFromNode, end }),
    [mode, startGlobal, startFromNode, end],
  );
}
