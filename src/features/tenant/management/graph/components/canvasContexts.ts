"use client";

import { createContext } from "react";
import type { Locale } from "@/i18n/locale";
import type { EasyConnectMode } from "../utils/easyConnect";

/** 編集キャンバスからノード内ラベル編集を受け取るための情報。 */
export type GraphNodeLabelEditing = {
  /** ラベルの編集言語（ポイント・グループで共有する） */
  locale: Locale;
  onUpdate: (id: string, label: string) => void;
  /** ラベルから編集を始めたとき、そのノードを選択状態にするために使う */
  onSelect: (id: string) => void;
};

export const GraphNodeLabelEditingContext = createContext<
  GraphNodeLabelEditing | undefined
>(undefined);

/** ルート追加モードの状態を各ノードへ伝えるコンテキスト。 */
export const GraphNodeEasyConnectContext =
  createContext<EasyConnectMode | null>(null);

/**
 * グループの手動リサイズ確定（NodeResizer の onResizeEnd）を
 * 編集キャンバスへ伝えるコールバック。表示専用では undefined。
 */
export const GroupResizeCommitContext = createContext<
  ((id: string, size: { width: number; height: number }) => void) | undefined
>(undefined);
