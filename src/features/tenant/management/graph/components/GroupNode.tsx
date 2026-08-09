"use client";

import { type NodeProps, NodeResizer } from "@xyflow/react";
import { useContext } from "react";
import type { GroupNodeType } from "../type";
import { GROUP_MIN_HEIGHT, GROUP_MIN_WIDTH } from "../utils/groups";
import { GraphNodeLabelEditingContext } from "./canvasContexts";
import { InlineNodeLabel } from "./InlineNodeLabel";

/**
 * 論理グルーピング（階・建物など）のコンテナ。
 * ポイントをドラッグして入れる/出すことで所属が変わる。
 * ルートの端点にはならないため、接続ハンドルを持たない。
 */
export function GroupNode({ id, data, selected }: NodeProps<GroupNodeType>) {
  const onUpdateLabel = useContext(GraphNodeLabelEditingContext);
  const editable = onUpdateLabel !== undefined;

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
        />
      ) : null}
      <div className="absolute top-0 left-0 z-10 max-w-full px-3 py-1.5">
        <InlineNodeLabel id={id} label={data.label} onUpdate={onUpdateLabel} />
      </div>
    </div>
  );
}
