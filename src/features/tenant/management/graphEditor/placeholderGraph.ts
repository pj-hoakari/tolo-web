import type { GraphData } from "./type";

export const PLACEHOLDER_GRAPH: GraphData = {
  nodes: [
    {
      id: "ph_entrance",
      type: "graph",
      position: { x: 40, y: 180 },
      data: { label: "入口", nodeType: "BOUNDARY" },
    },
    {
      id: "ph_junction",
      type: "graph",
      position: { x: 300, y: 180 },
      data: { label: "エントランスホール", nodeType: "TRANSIT_ONLY" },
    },
    {
      id: "ph_booth",
      type: "graph",
      position: { x: 580, y: 50 },
      data: { label: "ブースA", nodeType: "GOAL" },
    },
    {
      id: "ph_wall",
      type: "graph",
      position: { x: 580, y: 310 },
      data: { label: "壁展示", nodeType: "GOAL_TRANSIT_MIXED" },
    },
    {
      id: "ph_exit",
      type: "graph",
      position: { x: 860, y: 180 },
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
  ],
};
