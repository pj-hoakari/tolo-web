"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { type Ref, useImperativeHandle } from "react";
import { type GraphKey, saveGraph, useGraph } from "@/features/graph";
import { useGraphViewer } from "../hooks/useGraphViewer";
import { useObservationPointSource } from "../hooks/useObservationPointSource";
import type { GraphData } from "../type";
import { GraphCanvas } from "./GraphCanvas";
import { GraphLoadState } from "./GraphLoadState";
import { GraphViewerToolbar } from "./GraphViewerToolbar";
import { ObservationLinkPanel } from "./observation";

export type GraphViewerHandle = {
  getGraphData: () => GraphData;
};

type GraphViewerProps = GraphKey & {
  /** 編集ページのパス。未指定なら編集への導線を出さない */
  editHref?: string;
};

function GraphViewerInner({
  tenantId,
  eventId,
  initialGraph,
  editHref,
  handleRef,
}: GraphViewerProps & {
  initialGraph: GraphData;
  handleRef?: Ref<GraphViewerHandle>;
}) {
  const { graph, canvas, toolbar, links, getGraphData } =
    useGraphViewer(initialGraph);

  const observationPoints = useObservationPointSource({
    tenantId,
    eventId,
    graph,
  });

  // 親から ref 経由で紐づけ済みデータを取得できるように
  useImperativeHandle(handleRef, () => ({ getGraphData }), [getGraphData]);

  const handleSave = () => {
    void saveGraph({ tenantId, eventId }, getGraphData());
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphViewerToolbar
        {...toolbar}
        editHref={editHref}
        onSave={handleSave}
      />
      <div className="flex min-h-0 flex-1">
        {/* editing を渡さない＝表示専用（移動・接続・削除ができない）キャンバス */}
        <GraphCanvas {...canvas} />
        <ObservationLinkPanel
          {...links}
          graph={graph}
          observationPoints={observationPoints}
        />
      </div>
    </div>
  );
}

/**
 * 会場グラフの表示専用ビュー。
 * グラフは `@/features/graph` 経由で取得する（取得元は意識しない）。
 * グラフ構造そのものは編集できず、選択したポイント / ルートへ
 * 観測点を紐づける操作だけを行う（構造の編集は `GraphEditor`）。
 */
export function GraphViewer({
  tenantId,
  eventId,
  editHref,
  ref,
}: GraphViewerProps & { ref?: Ref<GraphViewerHandle> }) {
  const loaded = useGraph({ tenantId, eventId });
  if (loaded.status !== "ready") {
    return <GraphLoadState status={loaded.status} onRetry={loaded.refresh} />;
  }
  return (
    <ReactFlowProvider>
      <GraphViewerInner
        tenantId={tenantId}
        eventId={eventId}
        initialGraph={loaded.graph}
        editHref={editHref}
        handleRef={ref}
      />
    </ReactFlowProvider>
  );
}
