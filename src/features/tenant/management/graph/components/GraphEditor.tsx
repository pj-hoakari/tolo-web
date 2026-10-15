"use client";

import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { type Ref, useEffect, useImperativeHandle, useState } from "react";
import {
  type GraphKey,
  GraphValidationError,
  saveGraph,
  useGraph,
} from "@/features/graph";
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

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "failed"; error: unknown };

const SAVED_STATUS_MS = 3000;

function SaveErrorAlert({ error }: { error: unknown }) {
  const t = useTranslations("Graph.editor");
  return (
    <div
      role="alert"
      className="border-destructive/50 border-b bg-destructive/10 px-4 py-2 text-destructive text-sm"
    >
      {error instanceof GraphValidationError ? (
        <>
          <p className="font-semibold">{t("saveInvalid")}</p>
          <p>{error.message}</p>
        </>
      ) : (
        <p className="font-semibold">{t("saveFailed")}</p>
      )}
    </div>
  );
}

function GraphEditorInner({
  tenantId,
  eventId,
  initialGraph,
  handleRef,
}: GraphEditorProps & {
  initialGraph: GraphData;
  handleRef?: Ref<GraphEditorHandle>;
}) {
  const { graph, canvas, toolbar, properties, getGraphData, setSelection } =
    useGraphEditor(initialGraph);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  // 親から ref 経由で編集済みデータを取得できるように
  useImperativeHandle(handleRef, () => ({ getGraphData }), [getGraphData]);

  useEffect(() => {
    if (saveState.status !== "saved") return;
    const timer = setTimeout(
      () => setSaveState({ status: "idle" }),
      SAVED_STATUS_MS,
    );
    return () => clearTimeout(timer);
  }, [saveState]);

  const handleSave = async () => {
    setSaveState({ status: "saving" });
    try {
      await saveGraph({ tenantId, eventId }, getGraphData());
      setSaveState({ status: "saved" });
    } catch (error) {
      setSaveState({ status: "failed", error });
      if (error instanceof GraphValidationError) {
        const targets = error.violations.filter(
          (v) => v.elementKind && v.elementId,
        );
        if (targets.length > 0) {
          setSelection(
            targets
              .filter((v) => v.elementKind !== "edge")
              .map((v) => v.elementId),
            targets
              .filter((v) => v.elementKind === "edge")
              .map((v) => v.elementId),
          );
        }
      }
    }
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
        saveStatus={saveState.status}
      />
      {saveState.status === "failed" && (
        <SaveErrorAlert error={saveState.error} />
      )}
      <div className="flex min-h-0 flex-1">
        <GraphCanvas {...canvas} />
        <PropertiesPanel {...properties} graph={graph} />
      </div>
    </div>
  );
}

/**
 * グラフの構造（ポイント・ルート）を編集するエディタ。
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
