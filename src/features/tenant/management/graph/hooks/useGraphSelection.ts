"use client";

import { useCallback, useState } from "react";

export type GraphSelection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | null;

/**
 * キャンバス上で選択中の要素だけを扱うフック。
 * グラフの内容には依存しないため、削除時の解除は `clearIfSelected` で行う。
 */
export function useGraphSelection() {
  const [selection, setSelection] = useState<GraphSelection>(null);

  const selectNode = useCallback((id: string) => {
    setSelection({ type: "node", id });
  }, []);

  const selectEdge = useCallback((id: string) => {
    setSelection({ type: "edge", id });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  /** 指定要素を選択中だったときだけ選択を解除する（削除時に使う） */
  const clearIfSelected = useCallback((type: "node" | "edge", id: string) => {
    setSelection((current) =>
      current?.type === type && current.id === id ? null : current,
    );
  }, []);

  return {
    selection,
    selectNode,
    selectEdge,
    clearSelection,
    clearIfSelected,
  };
}
