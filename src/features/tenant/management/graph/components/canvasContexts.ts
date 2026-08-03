"use client";

import { createContext } from "react";
import type { EasyConnectMode } from "../utils/easyConnect";

/** 編集キャンバスからノード内ラベル編集を受け取るためのコールバック。 */
export const GraphNodeLabelEditingContext = createContext<
  ((id: string, label: string) => void) | undefined
>(undefined);

/** ルート追加モードの状態を各ノードへ伝えるコンテキスト。 */
export const GraphNodeEasyConnectContext =
  createContext<EasyConnectMode | null>(null);
