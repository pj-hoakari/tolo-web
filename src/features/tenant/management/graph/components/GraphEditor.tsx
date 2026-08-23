"use client";

import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { type Ref, useImperativeHandle } from "react";
import { type GraphKey, saveGraph, useGraph } from "@/features/graph";
import { useGraphEditor } from "../hooks/useGraphEditor";
import type { GraphData } from "../type";
import { FIT_VIEW_OPTIONS, GraphCanvas } from "./GraphCanvas";
import { GraphEditorToolbar } from "./GraphEditorToolbar";
import { GraphLoadState } from "./GraphLoadState";
import { PropertiesPanel } from "./properties";

export type GraphEditorHandle = {
  getGraphData: () => GraphData;
};

type GraphEditorProps = GraphKey;

function GraphEditorInner({
  tenantId,
  eventId,
  initialGraph,
  handleRef,
}: GraphEditorProps & {
  initialGraph: GraphData;
  handleRef?: Ref<GraphEditorHandle>;
}) {
  const { graph, canvas, toolbar, properties, getGraphData } =
    useGraphEditor(initialGraph);

  // 親から ref 経由で編集済みデータを取得できるように
  useImperativeHandle(handleRef, () => ({ getGraphData }), [getGraphData]);

  const handleSave = () => {
    void saveGraph({ tenantId, eventId }, getGraphData());
  };

  const { fitView } = useReactFlow();
  const handleAutoAlign = () => {
    toolbar.onAutoAlign();
    // 整列後の位置がキャンバスへ反映されてから、全体をビューに収める
    requestAnimationFrame(() => {
      void fitView({ ...FIT_VIEW_OPTIONS, duration: 300 });
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphEditorToolbar
        {...toolbar}
        onAutoAlign={handleAutoAlign}
        onSave={handleSave}
      />
      <div className="flex min-h-0 flex-1">
        <GraphCanvas {...canvas} />
        <PropertiesPanel {...properties} graph={graph} />
      </div>
    </div>
  );
}

/**
 * 会場グラフの構造（ポイント・ルート）を編集するエディタ。
 * グラフは `@/features/graph` 経由で取得する（取得元は意識しない）。
 * 観測点などの付随情報は扱わず、紐づけは `GraphViewer` が担当する。
 */
export function GraphEditor({
  tenantId,
  eventId,
  ref,
}: GraphEditorProps & { ref?: Ref<GraphEditorHandle> }) {
  const loaded = useGraph({ tenantId, eventId });
  if (loaded.status !== "ready") {
    return <GraphLoadState status={loaded.status} onRetry={loaded.refresh} />;
  }
  return (
    <ReactFlowProvider>
      <GraphEditorInner
        tenantId={tenantId}
        eventId={eventId}
        initialGraph={loaded.graph}
        handleRef={ref}
      />
    </ReactFlowProvider>
  );
}
