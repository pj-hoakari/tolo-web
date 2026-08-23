import type { GraphData } from "@/features/tenant/management/graph/type";
import placeholderGraph from "./placeholderGraph.json";

/**
 * API 未接続時に返すサンプルグラフ（`placeholderGraph.json`）。
 * 1F / 2F をグループ（論理グルーピング）で表す。
 * 階段・エレベーターは「各階の乗降口ポイント（通過専用）」＋ 「階をまたぐルート」で表現する。
 * グループ内のノードの position は親グループ相対。
 * ポイントの position はノード中心（グループは左上）を指す。
 * ポイント・グループのラベルは多言語設定の例として ja / en を持つ。
 * React Flow の制約により、親グループは子ノードより先に並べる。
 */
export const PLACEHOLDER_GRAPH = placeholderGraph as GraphData;
