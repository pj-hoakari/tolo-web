"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { type Ref, useImperativeHandle } from "react";
import { useGraphEditor } from "../hooks/useGraphEditor";
import { useObservationPointSource } from "../hooks/useObservationPointSource";
import type { GraphData } from "../type";
import { GraphEditorCanvas } from "./GraphEditorCanvas";
import { GraphToolbar } from "./GraphToolbar";
import { PropertiesPanel } from "./properties";

export type GraphEditorHandle = {
  getGraphData: () => GraphData;
};

type GraphEditorProps = {
  tenantId: string;
  eventId: string;
  initialGraph?: GraphData;
};

function GraphEditorInner({
  tenantId,
  eventId,
  initialGraph,
  handleRef,
}: GraphEditorProps & { handleRef?: Ref<GraphEditorHandle> }) {
  const { graph, canvas, toolbar, properties, getGraphData } =
    useGraphEditor(initialGraph);

  const observationPoints = useObservationPointSource({
    tenantId,
    eventId,
    graph,
  });

  // 親から ref 経由で編集済みデータを取得できるように
  useImperativeHandle(handleRef, () => ({ getGraphData }), [getGraphData]);

  const handleSave = () => {
    const data = getGraphData();
    // TODO: API 送信に差し替え
    console.log(data);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphToolbar {...toolbar} onSave={handleSave} />
      <div className="flex min-h-0 flex-1">
        <GraphEditorCanvas {...canvas} />
        <PropertiesPanel
          {...properties}
          graph={graph}
          observationPoints={observationPoints}
        />
      </div>
    </div>
  );
}

export function GraphEditor({
  tenantId,
  eventId,
  initialGraph,
  ref,
}: GraphEditorProps & { ref?: Ref<GraphEditorHandle> }) {
  return (
    <ReactFlowProvider>
      <GraphEditorInner
        tenantId={tenantId}
        eventId={eventId}
        initialGraph={initialGraph}
        handleRef={ref}
      />
    </ReactFlowProvider>
  );
}
