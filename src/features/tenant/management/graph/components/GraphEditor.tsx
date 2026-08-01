"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { type Ref, useImperativeHandle } from "react";
import { useGraphEditor } from "../hooks/useGraphEditor";
import type { GraphData } from "../type";
import { GraphCanvas } from "./GraphCanvas";
import { GraphEditorToolbar } from "./GraphEditorToolbar";
import { PropertiesPanel } from "./properties";

export type GraphEditorHandle = {
  getGraphData: () => GraphData;
};

type GraphEditorProps = {
  initialGraph?: GraphData;
};

function GraphEditorInner({
  initialGraph,
  handleRef,
}: GraphEditorProps & { handleRef?: Ref<GraphEditorHandle> }) {
  const { graph, canvas, toolbar, properties, getGraphData } =
    useGraphEditor(initialGraph);

  // 親から ref 経由で編集済みデータを取得できるように
  useImperativeHandle(handleRef, () => ({ getGraphData }), [getGraphData]);

  const handleSave = () => {
    const data = getGraphData();
    // TODO: API 送信に差し替え
    console.log(data);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphEditorToolbar {...toolbar} onSave={handleSave} />
      <div className="flex min-h-0 flex-1">
        <GraphCanvas {...canvas} />
        <PropertiesPanel {...properties} graph={graph} />
      </div>
    </div>
  );
}

/**
 * 会場グラフの構造（ポイント・ルート）を編集するエディタ。
 * 観測点などの付随情報は扱わず、紐づけは `GraphViewer` が担当する。
 */
export function GraphEditor({
  initialGraph,
  ref,
}: GraphEditorProps & { ref?: Ref<GraphEditorHandle> }) {
  return (
    <ReactFlowProvider>
      <GraphEditorInner initialGraph={initialGraph} handleRef={ref} />
    </ReactFlowProvider>
  );
}
