import type { GraphData } from "./type";

/**
 * 初回表示用のサンプルグラフ。
 * 1F / 2F をグループ（論理グルーピング）で表す。
 * 階段・エレベーターは「各階の乗降口ポイント（通過専用）」＋
 * 「階をまたぐルート」で表現する。通路そのものはルートで表すという
 * 仕様の原則（容量・方向制約・所要時間はルートの属性）に合わせた形。
 * グループ内のノードの position は親グループ相対。
 * React Flow の制約により、親グループは子ノードより先に並べる。
 */
export const PLACEHOLDER_GRAPH: GraphData = {
  nodes: [
    {
      id: "ph_floor2",
      type: "graphGroup",
      position: { x: 40, y: 0 },
      width: 880,
      height: 260,
      data: { label: "2F" },
    },
    {
      id: "ph_floor1",
      type: "graphGroup",
      position: { x: 0, y: 320 },
      width: 1060,
      height: 460,
      data: { label: "1F" },
    },
    // --- 2F ---
    {
      id: "ph_stairs2f",
      type: "graph",
      parentId: "ph_floor2",
      position: { x: 140, y: 170 },
      data: { label: "2F 階段", nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "ph_hall2f",
      type: "graph",
      parentId: "ph_floor2",
      position: { x: 270, y: 40 },
      data: { label: "2F ホール", nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "ph_elevator2f",
      type: "graph",
      parentId: "ph_floor2",
      position: { x: 420, y: 170 },
      data: { label: "2F エレベーター", nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "ph_gallery2f",
      type: "graph",
      parentId: "ph_floor2",
      position: { x: 620, y: 40 },
      data: { label: "展示室B", nodeType: "GOAL_TRANSIT_MIXED" },
    },
    // --- 1F ---
    {
      id: "ph_stairs1f",
      type: "graph",
      parentId: "ph_floor1",
      position: { x: 180, y: 40 },
      data: { label: "1F 階段", nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "ph_elevator1f",
      type: "graph",
      parentId: "ph_floor1",
      position: { x: 460, y: 40 },
      data: { label: "1F エレベーター", nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "ph_entrance",
      type: "graph",
      parentId: "ph_floor1",
      position: { x: 40, y: 210 },
      data: { label: "入口", nodeType: "BOUNDARY" },
    },
    {
      id: "ph_junction",
      type: "graph",
      parentId: "ph_floor1",
      position: { x: 300, y: 210 },
      data: { label: "エントランスホール", nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "ph_booth",
      type: "graph",
      parentId: "ph_floor1",
      position: { x: 620, y: 110 },
      data: { label: "ブースA", nodeType: "GOAL" },
    },
    {
      id: "ph_wall",
      type: "graph",
      parentId: "ph_floor1",
      position: { x: 620, y: 330 },
      data: { label: "壁展示", nodeType: "GOAL_TRANSIT_MIXED" },
    },
    {
      id: "ph_exit",
      type: "graph",
      parentId: "ph_floor1",
      position: { x: 880, y: 210 },
      data: { label: "出口", nodeType: "BOUNDARY" },
    },
  ],
  edges: [
    // 片側通行（入口は出力のみ）
    {
      id: "ph_e1",
      source: "ph_entrance",
      target: "ph_junction",
      type: "graph",
      data: { direction: "oneway" },
    },
    // 両通行
    {
      id: "ph_e2",
      source: "ph_junction",
      target: "ph_booth",
      type: "graph",
      data: { direction: "both" },
    },
    {
      id: "ph_e3",
      source: "ph_junction",
      target: "ph_wall",
      type: "graph",
      data: { direction: "both" },
    },
    // 片側通行（出口は入力のみ）
    {
      id: "ph_e4",
      source: "ph_booth",
      target: "ph_exit",
      type: "graph",
      data: { direction: "oneway" },
    },
    {
      id: "ph_e5",
      source: "ph_wall",
      target: "ph_exit",
      type: "graph",
      data: { direction: "oneway" },
    },
    // 1F 内の通路（ホール ⇌ 各乗降口）
    {
      id: "ph_e6",
      source: "ph_junction",
      target: "ph_stairs1f",
      type: "graph",
      data: { direction: "both" },
    },
    {
      id: "ph_e7",
      source: "ph_junction",
      target: "ph_elevator1f",
      type: "graph",
      data: { direction: "both" },
    },
    // 階段・エレベーター本体 = 階をまたぐルート
    {
      id: "ph_e8",
      source: "ph_stairs1f",
      target: "ph_stairs2f",
      type: "graph",
      data: { direction: "both", label: "階段" },
    },
    {
      id: "ph_e9",
      source: "ph_elevator1f",
      target: "ph_elevator2f",
      type: "graph",
      data: { direction: "both", label: "エレベーター" },
    },
    // 2F 内の通路
    {
      id: "ph_e10",
      source: "ph_stairs2f",
      target: "ph_hall2f",
      type: "graph",
      data: { direction: "both" },
    },
    {
      id: "ph_e11",
      source: "ph_elevator2f",
      target: "ph_hall2f",
      type: "graph",
      data: { direction: "both" },
    },
    {
      id: "ph_e12",
      source: "ph_hall2f",
      target: "ph_gallery2f",
      type: "graph",
      data: { direction: "both" },
    },
  ],
};
