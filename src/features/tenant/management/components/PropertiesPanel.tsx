"use client";

import { useId } from "react";
import {
  NODE_TYPE_DEFS,
  validateAssignType,
  validateEdgeDirection,
  validateReverseEdge,
} from "../nodeTypes";
import type {
  EdgeDirection,
  GraphEdgeData,
  GraphEdgeType,
  GraphNodeData,
  GraphNodeType,
} from "../type";
import { NodeTypeIcon } from "./NodeTypeIcon";

type Props = {
  selectedNode: GraphNodeType | undefined;
  selectedEdge: GraphEdgeType | undefined;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  onUpdateNode: (id: string, patch: Partial<GraphNodeData>) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdgeData>) => void;
  onReverseEdge: (id: string) => void;
  onDelete: () => void;
};

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  nodes,
  edges,
  onUpdateNode,
  onUpdateEdge,
  onReverseEdge,
  onDelete,
}: Props) {
  const hasSelection = Boolean(selectedNode || selectedEdge);
  return (
    <aside className="flex w-72 shrink-0 flex-col border-zinc-200 border-l bg-white">
      <div className="border-zinc-200 border-b px-4 py-2">
        <p className="font-semibold text-sm text-zinc-900">プロパティ</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <NodeForm
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            onChange={(patch) => onUpdateNode(selectedNode.id, patch)}
          />
        ) : selectedEdge ? (
          <EdgeForm
            edge={selectedEdge}
            nodes={nodes}
            edges={edges}
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
            ポイントまたはルートを選択してください。
          </p>
        )}
      </div>
      {hasSelection ? (
        <div className="border-zinc-200 border-t p-3">
          <button
            type="button"
            onClick={onDelete}
            className="w-full rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-600 text-xs shadow-sm hover:bg-red-50"
          >
            {selectedNode ? "このポイントを削除" : "このルートを削除"}
          </button>
        </div>
      ) : null}
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
  nodes,
  edges,
  onChange,
}: {
  node: GraphNodeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  onChange: (patch: Partial<GraphNodeData>) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-[10px] text-sky-700">
          ポイント
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

      <div>
        <p className="mb-1 font-medium text-[11px] text-zinc-600">タイプ</p>
        <div className="space-y-1">
          {NODE_TYPE_DEFS.map((def) => {
            const selected = def.type === node.data.nodeType;
            const result = validateAssignType(def.type, node.id, nodes, edges);
            const assignable = selected || result.ok;
            return (
              <div key={def.type} className="space-y-0.5">
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={!assignable}
                  onClick={() => onChange({ nodeType: def.type })}
                  className={[
                    "flex w-full flex-col rounded-md border px-2 py-1.5 text-left transition",
                    selected
                      ? "border-sky-500 bg-sky-50 ring-1 ring-sky-200"
                      : "border-zinc-200 hover:bg-zinc-50",
                    assignable ? "" : "cursor-not-allowed opacity-40",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-1.5 font-medium text-xs text-zinc-900">
                    <NodeTypeIcon type={def.type} />
                    {def.label}
                  </span>
                  <span className="mt-0.5 text-[10px] text-zinc-500">
                    {def.description}
                  </span>
                </button>
                {!selected && !result.ok ? (
                  <ConstraintNote message={result.message} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EdgeForm({
  edge,
  nodes,
  edges,
  sourceLabel,
  targetLabel,
  onChange,
  onReverse,
}: {
  edge: GraphEdgeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  sourceLabel: string;
  targetLabel: string;
  onChange: (patch: Partial<GraphEdgeData>) => void;
  onReverse: () => void;
}) {
  const direction: EdgeDirection = edge.data?.direction ?? "both";

  const bothResult = validateEdgeDirection(edge, "both", nodes, edges);
  const onewayResult = validateEdgeDirection(edge, "oneway", nodes, edges);
  const bothDisabled = direction !== "both" && !bothResult.ok;
  const onewayDisabled = direction !== "oneway" && !onewayResult.ok;
  const directionReason = !bothResult.ok
    ? bothResult.message
    : !onewayResult.ok
      ? onewayResult.message
      : null;

  const reverseResult = validateReverseEdge(edge, nodes, edges);

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-[10px] text-amber-700">
          ルート
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
            disabled={bothDisabled}
            onClick={() => onChange({ direction: "both" })}
            label="両通行可 ⇌"
          />
          <SegmentToggle
            active={direction === "oneway"}
            disabled={onewayDisabled}
            onClick={() => onChange({ direction: "oneway" })}
            label="片方向 →"
          />
        </div>
        {directionReason ? (
          <div className="mt-1">
            <ConstraintNote message={directionReason} />
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <button
          type="button"
          onClick={onReverse}
          disabled={direction === "both" || !reverseResult.ok}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          向きを反転（始点↔終点）
        </button>
        {direction !== "both" && !reverseResult.ok ? (
          <ConstraintNote message={reverseResult.message} />
        ) : null}
      </div>
    </div>
  );
}

function ConstraintNote({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1 text-[10px] text-amber-600">
      <span aria-hidden>⚠</span>
      <span>{message}</span>
    </p>
  );
}

function SegmentToggle({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex-1 rounded-[5px] px-2 py-1 font-medium text-xs transition",
        active
          ? "bg-white text-sky-700 shadow-sm"
          : "text-zinc-500 hover:text-zinc-700",
        disabled ? "cursor-not-allowed opacity-40 hover:text-zinc-500" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
