import { getNodeTypeDef } from "../../nodeTypes";
import type { GraphData, GraphEdgeType, GraphNodeType } from "../../type";
import { NodeTypeIcon } from "../NodeTypeIcon";
import { EdgeEndpoints } from "../properties/EdgeEndpoints";
import { SelectionHeader } from "../properties/SelectionHeader";
import {
  ObservationPointPicker,
  type ObservationPointsSource,
} from "./ObservationPointPicker";

export type ObservationLinkPanelProps = {
  selectedNode: GraphNodeType | undefined;
  selectedEdge: GraphEdgeType | undefined;
  /** 端点ラベルの解決に使うグラフ全体 */
  graph: GraphData;
  /** 紐づけ候補となる観測点（接続中のエッジ）一式 */
  observationPoints: ObservationPointsSource;
  onLinkNode: (id: string, observationPointIds: string[]) => void;
  onLinkEdge: (id: string, observationPointIds: string[]) => void;
};

/**
 * 選択中のポイント / ルートに付随情報を紐づけるパネル。
 * グラフ構造（ラベル・タイプ・方向・接続）は編集できず、
 * 現在は観測点の紐づけのみを扱う。
 */
export function ObservationLinkPanel({
  selectedNode,
  selectedEdge,
  graph,
  observationPoints,
  onLinkNode,
  onLinkEdge,
}: ObservationLinkPanelProps) {
  const { nodes } = graph;
  return (
    <aside className="flex w-72 shrink-0 flex-col border-border border-l bg-card">
      <div className="border-border border-b px-4 py-2">
        <p className="font-semibold text-foreground text-sm">観測点の紐づけ</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <div className="space-y-3 rounded-md border border-border bg-card p-3">
            <SelectionHeader kind="node" id={selectedNode.id} />
            <NodeSummary node={selectedNode} />
            <ObservationPointPicker
              {...observationPoints}
              linkedIds={selectedNode.data.observationPointIds ?? []}
              onChange={(ids) => onLinkNode(selectedNode.id, ids)}
            />
          </div>
        ) : selectedEdge ? (
          <div className="space-y-3 rounded-md border border-border bg-card p-3">
            <SelectionHeader kind="edge" id={selectedEdge.id} />
            <EdgeEndpoints
              sourceLabel={
                nodes.find((n) => n.id === selectedEdge.source)?.data.label ??
                selectedEdge.source
              }
              targetLabel={
                nodes.find((n) => n.id === selectedEdge.target)?.data.label ??
                selectedEdge.target
              }
              direction={selectedEdge.data?.direction ?? "both"}
            />
            <ObservationPointPicker
              {...observationPoints}
              linkedIds={selectedEdge.data?.observationPointIds ?? []}
              onChange={(ids) => onLinkEdge(selectedEdge.id, ids)}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            観測点を紐づけるポイントまたはルートを選択してください。
          </p>
        )}
      </div>
      <div className="border-border border-t px-4 py-3">
        <p className="text-[10px] text-muted-foreground">
          ポイント / ルートの追加・削除やタイプの変更は編集ページで行います。
        </p>
      </div>
    </aside>
  );
}

/** 選択中のポイントの種別とラベルを示す読み取り専用のサマリ */
function NodeSummary({ node }: { node: GraphNodeType }) {
  const def = getNodeTypeDef(node.data.nodeType);
  return (
    <div className="rounded-md bg-muted p-2">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <NodeTypeIcon type={def.type} />
        {def.label}
      </p>
      <p className="font-medium text-foreground text-xs">{node.data.label}</p>
    </div>
  );
}
