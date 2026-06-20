import { useId } from "react";
import type { AliveEdgesStatus } from "@/features/tenant/webrtc/hooks/useAliveEdges";
import type { AliveEdge } from "@/features/tenant/webrtc/type";
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
  /** 紐づけ候補となる観測点（接続中のエッジ）一覧 */
  observationPoints: AliveEdge[];
  observationPointsStatus?: AliveEdgesStatus;
  /** いずれかのノード/ルートで使用中（＝他では選択不可）の観測点 ID 集合 */
  usedObservationPointIds: ReadonlySet<string>;
  onRefreshObservationPoints?: () => void;
  onUpdateNode: (id: string, patch: Partial<GraphNodeData>) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdgeData>) => void;
  onReverseEdge: (id: string) => void;
  /** 観測点のリンク操作（対象の紐づけを ids に更新する） */
  onLinkObservationPoints: (
    target: { type: "node" | "edge"; id: string },
    ids: string[],
  ) => void;
  onDelete: () => void;
};

export function PropertiesPanel({
  selectedNode,
  selectedEdge,
  nodes,
  edges,
  observationPoints,
  observationPointsStatus,
  usedObservationPointIds,
  onRefreshObservationPoints,
  onUpdateNode,
  onUpdateEdge,
  onReverseEdge,
  onLinkObservationPoints,
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
            observationPoints={observationPoints}
            observationPointsStatus={observationPointsStatus}
            usedObservationPointIds={usedObservationPointIds}
            onRefreshObservationPoints={onRefreshObservationPoints}
            onChange={(patch) => onUpdateNode(selectedNode.id, patch)}
            onChangeObservationPoints={(ids) =>
              onLinkObservationPoints(
                { type: "node", id: selectedNode.id },
                ids,
              )
            }
          />
        ) : selectedEdge ? (
          <EdgeForm
            edge={selectedEdge}
            nodes={nodes}
            edges={edges}
            observationPoints={observationPoints}
            observationPointsStatus={observationPointsStatus}
            usedObservationPointIds={usedObservationPointIds}
            onRefreshObservationPoints={onRefreshObservationPoints}
            onChangeObservationPoints={(ids) =>
              onLinkObservationPoints(
                { type: "edge", id: selectedEdge.id },
                ids,
              )
            }
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
  observationPoints,
  observationPointsStatus,
  usedObservationPointIds,
  onRefreshObservationPoints,
  onChange,
  onChangeObservationPoints,
}: {
  node: GraphNodeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  observationPoints: AliveEdge[];
  observationPointsStatus?: AliveEdgesStatus;
  usedObservationPointIds: ReadonlySet<string>;
  onRefreshObservationPoints?: () => void;
  onChange: (patch: Partial<GraphNodeData>) => void;
  onChangeObservationPoints: (ids: string[]) => void;
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

      <ObservationPointPicker
        linkedIds={node.data.observationPointIds ?? []}
        available={observationPoints}
        status={observationPointsStatus}
        usedIds={usedObservationPointIds}
        onRefresh={onRefreshObservationPoints}
        onChange={onChangeObservationPoints}
      />
    </div>
  );
}

function EdgeForm({
  edge,
  nodes,
  edges,
  observationPoints,
  observationPointsStatus,
  usedObservationPointIds,
  onRefreshObservationPoints,
  sourceLabel,
  targetLabel,
  onChange,
  onReverse,
  onChangeObservationPoints,
}: {
  edge: GraphEdgeType;
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  observationPoints: AliveEdge[];
  observationPointsStatus?: AliveEdgesStatus;
  usedObservationPointIds: ReadonlySet<string>;
  onRefreshObservationPoints?: () => void;
  sourceLabel: string;
  targetLabel: string;
  onChange: (patch: Partial<GraphEdgeData>) => void;
  onReverse: () => void;
  onChangeObservationPoints: (ids: string[]) => void;
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

      <ObservationPointPicker
        linkedIds={edge.data?.observationPointIds ?? []}
        available={observationPoints}
        status={observationPointsStatus}
        usedIds={usedObservationPointIds}
        onRefresh={onRefreshObservationPoints}
        onChange={onChangeObservationPoints}
      />
    </div>
  );
}

/**
 * 観測点（接続中のエッジ）をノード/ルートに紐づけるピッカー
 * 接続中の観測点+紐づけ済みだが現在オフラインの観測点
 * いずれかの要素で使用中の観測点は、この要素で未選択なら選択不可
 */
function ObservationPointPicker({
  linkedIds,
  available,
  status,
  usedIds,
  onRefresh,
  onChange,
}: {
  linkedIds: string[];
  available: AliveEdge[];
  status?: AliveEdgesStatus;
  usedIds: ReadonlySet<string>;
  onRefresh?: () => void;
  onChange: (ids: string[]) => void;
}) {
  const aliveIds = new Set(available.map((e) => e.id));
  // 表示順: 接続中の観測点 → 紐づけ済みだが現在オフラインの観測点
  const rows: { id: string; online: boolean }[] = [
    ...available.map((e) => ({ id: e.id, online: true })),
    ...linkedIds
      .filter((id) => !aliveIds.has(id))
      .map((id) => ({ id, online: false })),
  ];

  const toggle = (id: string) => {
    onChange(
      linkedIds.includes(id)
        ? linkedIds.filter((x) => x !== id)
        : [...linkedIds, id],
    );
  };

  const loading = status === "loading";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-medium text-[11px] text-zinc-600">
          観測点{linkedIds.length > 0 ? `（${linkedIds.length}）` : ""}
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-[10px] text-sky-600 hover:text-sky-700 disabled:opacity-50"
          >
            更新
          </button>
        ) : null}
      </div>

      {status === "error" ? (
        <p className="text-[10px] text-red-600">観測点の取得に失敗しました</p>
      ) : rows.length === 0 ? (
        <p className="text-[10px] text-zinc-500">
          {loading ? "読み込み中…" : "接続中の観測点がありません"}
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => {
            const checked = linkedIds.includes(row.id);
            // 自分で選択済みは解除可。他で使用中の未選択のみ選択不可
            const disabled = !checked && usedIds.has(row.id);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  disabled={disabled}
                  onClick={() => toggle(row.id)}
                  className={[
                    "flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left transition",
                    checked
                      ? "border-sky-500 bg-sky-50 ring-1 ring-sky-200"
                      : "border-zinc-200 hover:bg-zinc-50",
                    disabled
                      ? "cursor-not-allowed opacity-50 hover:bg-white"
                      : "",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={[
                      "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[9px] text-white",
                      checked
                        ? "border-sky-500 bg-sky-500"
                        : "border-zinc-300 bg-white",
                    ].join(" ")}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span
                        aria-hidden
                        title={row.online ? "接続中" : "オフライン"}
                        className={[
                          "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                          row.online ? "bg-emerald-500" : "bg-zinc-300",
                        ].join(" ")}
                      />
                      <span className="break-all font-mono text-[10px] text-zinc-700">
                        {row.id}
                      </span>
                    </span>
                    {disabled ? (
                      <span className="text-[9px] text-amber-600">
                        他のポイント / ルートで使用中
                      </span>
                    ) : !row.online ? (
                      <span className="text-[9px] text-zinc-400">
                        オフライン
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
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
