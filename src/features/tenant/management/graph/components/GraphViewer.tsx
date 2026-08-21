"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { type Ref, useImperativeHandle } from "react";
import { useGraphViewer } from "../hooks/useGraphViewer";
import { useObservationPointSource } from "../hooks/useObservationPointSource";
import type { GraphData } from "../type";
import { GraphCanvas } from "./GraphCanvas";
import { GraphViewerToolbar } from "./GraphViewerToolbar";
import { ObservationLinkPanel } from "./observation";

export type GraphViewerHandle = {
  getGraphData: () => GraphData;
};

type GraphViewerProps = {
  tenantId: string;
  eventId: string;
  initialGraph?: GraphData;
  /** 編集ページのパス。未指定なら編集への導線を出さない */
  editHref?: string;
};

function GraphViewerInner({
  tenantId,
  eventId,
  initialGraph,
  editHref,
  handleRef,
}: GraphViewerProps & { handleRef?: Ref<GraphViewerHandle> }) {
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
    const data = getGraphData();
    // TODO: API 送信に差し替え
    console.log(data);
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
 * グラフ構造そのものは編集できず、選択したポイント / ルートへ
 * 観測点を紐づける操作だけを行う（構造の編集は `GraphEditor`）。
 */
export function GraphViewer({
  tenantId,
  eventId,
  initialGraph,
  editHref,
  ref,
}: GraphViewerProps & { ref?: Ref<GraphViewerHandle> }) {
  return (
    <ReactFlowProvider>
      <GraphViewerInner
        tenantId={tenantId}
        eventId={eventId}
        initialGraph={initialGraph}
        editHref={editHref}
        handleRef={ref}
      />
    </ReactFlowProvider>
  );
}
