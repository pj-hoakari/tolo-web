"use client";

import { useId } from "react";
import type {
  EdgeDirection,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
  GraphNodeType,
} from "../type";

type Props = {
  selectedNode: GraphNodeType | undefined;
  selectedEdge: GraphEdgeType | undefined;
  nodes: GraphNodeType[];
  onUpdateNode: (id: string, patch: Partial<GraphNodeData>) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdgeData>) => void;
  onReverseEdge: (id: string) => void;
};

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  nodes,
  onUpdateNode,
  onUpdateEdge,
  onReverseEdge,
}: Props) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-zinc-200 border-l bg-white">
      <div className="border-zinc-200 border-b px-4 py-2">
        <p className="font-semibold text-sm text-zinc-900">プロパティ</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <NodeForm
            node={selectedNode}
            onChange={(patch) => onUpdateNode(selectedNode.id, patch)}
          />
        ) : selectedEdge ? (
          <EdgeForm
            edge={selectedEdge}
            sourceLabel={
              nodes.find((n) => n.id === selectedEdge.source)?.data.label ??
              selectedEdge.source
            }
            targetLabel={
              nodes.find((n) => n.id === selectedEdge.target)?.data.label ??
              selectedEdge.target
            }
            onChange={(patch) => onUpdateEdge(selectedEdge.id, patch)}
            onReverse={() => onReverseEdge(selectedEdge.id)}
          />
        ) : (
          <p className="text-xs text-zinc-500">
            ノードまたはエッジを選択するとここに表示されます。
          </p>
        )}
      </div>
    </aside>
  );
}

const inputClass =
  "block w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block font-medium text-[11px] text-zinc-600"
      >
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function NodeForm({
  node,
  onChange,
}: {
  node: GraphNodeType;
  onChange: (patch: Partial<GraphNodeData>) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-[10px] text-sky-700">
          ノード
        </span>
        <code className="text-[10px] text-zinc-400">{node.id}</code>
      </div>
      <Field label="ラベル">
        {(id) => (
          <input
            id={id}
            className={inputClass}
            value={node.data.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}

function EdgeForm({
  edge,
  sourceLabel,
  targetLabel,
  onChange,
  onReverse,
}: {
  edge: GraphEdgeType;
  sourceLabel: string;
  targetLabel: string;
  onChange: (patch: Partial<GraphEdgeData>) => void;
  onReverse: () => void;
}) {
  const direction: EdgeDirection = edge.data?.direction ?? "both";
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-[10px] text-amber-700">
          エッジ
        </span>
        <code className="text-[10px] text-zinc-400">{edge.id}</code>
      </div>

      <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-700">
        <div className="flex items-center gap-2">
          <span className="font-medium">{sourceLabel}</span>
          <span className="font-mono text-base text-zinc-500">
            {direction === "both" ? "⇌" : "→"}
          </span>
          <span className="font-medium">{targetLabel}</span>
        </div>
      </div>

      <div>
        <p className="mb-1 font-medium text-[11px] text-zinc-600">方向</p>
        <div className="flex gap-1 rounded-md bg-zinc-100 p-0.5">
          <SegmentToggle
            active={direction === "both"}
            onClick={() => onChange({ direction: "both" })}
            label="両通行可 ⇌"
          />
          <SegmentToggle
            active={direction === "oneway"}
            onClick={() => onChange({ direction: "oneway" })}
            label="片方向 →"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onReverse}
        disabled={direction === "both"}
        title={
          direction === "both"
            ? "両通行可のエッジは反転の必要がありません"
            : "始点と終点を入れ替えます"
        }
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        向きを反転（始点↔終点）
      </button>
    </div>
  );
}

function SegmentToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "flex-1 rounded-[5px] px-2 py-1 font-medium text-xs transition",
        active
          ? "bg-white text-sky-700 shadow-sm"
          : "text-zinc-500 hover:text-zinc-700",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
