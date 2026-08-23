"use client";

import { type NodeProps, NodeResizer } from "@xyflow/react";
import { useContext } from "react";
import { localeLabels } from "@/i18n/locale";
import type { GroupNodeType } from "../type";
import { GROUP_MIN_HEIGHT, GROUP_MIN_WIDTH } from "../utils/groups";
import {
  GraphNodeLabelEditingContext,
  GroupResizeCommitContext,
} from "./canvasContexts";
import { InlineNodeLabel } from "./InlineNodeLabel";

/**
 * 論理グルーピング（階・建物など）のコンテナ。
 * ポイントをドラッグして入れる/出すことで所属が変わる。
 * ルートの端点にはならないため、接続ハンドルを持たない。
 */
export function GroupNode({ id, data, selected }: NodeProps<GroupNodeType>) {
  // ラベルの編集言語はポイントと共通のコンテキストから受け取る
  const labelEditing = useContext(GraphNodeLabelEditingContext);
  const onResizeCommit = useContext(GroupResizeCommitContext);
  const editable = labelEditing !== undefined;

  return (
    <div
      className={`h-full w-full rounded-xl border-2 border-dashed transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/40 bg-muted/40 hover:border-muted-foreground/70"
      }`}
    >
      {editable ? (
        <NodeResizer
          isVisible={selected}
          minWidth={GROUP_MIN_WIDTH}
          minHeight={GROUP_MIN_HEIGHT}
          onResizeEnd={(_, params) =>
            onResizeCommit?.(id, {
              width: params.width,
              height: params.height,
            })
          }
        />
      ) : null}
      {/* ラベルは点線の上辺に重ねて置き、グループ内部のヒット領域を塞がない */}
      <div className="absolute top-0 left-3 z-10 max-w-[calc(100%-1.5rem)] -translate-y-1/2">
        <InlineNodeLabel
          id={id}
          kind="group"
          appearance="box"
          label={data.label ?? ""}
          isFallback={data.labelIsFallback ?? false}
          editValue={
            labelEditing ? (data.labels[labelEditing.locale] ?? "") : undefined
          }
          languageName={
            labelEditing ? localeLabels[labelEditing.locale] : undefined
          }
          onUpdate={labelEditing?.onUpdate}
          onEditStart={
            labelEditing ? () => labelEditing.onSelect(id) : undefined
          }
        />
      </div>
    </div>
  );
}
