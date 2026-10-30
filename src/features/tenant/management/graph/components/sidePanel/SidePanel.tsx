import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { GraphData } from "../../type";
import type { GraphElementEntry } from "../../utils/relatedElements";
import type { BulkPropertiesBindings } from "../properties/BulkProperties";
import { BulkSelection } from "../properties/BulkSelection";
import {
  SelectionActions,
  type SelectionActionsBindings,
} from "../properties/SelectionActions";
import {
  SelectionProperties,
  type SelectionPropertiesBindings,
} from "../properties/SelectionProperties";
import { type SidePanelSelection, sidePanelView } from "./sidePanelView";

export type SidePanelProps = SidePanelSelection &
  SelectionPropertiesBindings &
  BulkPropertiesBindings &
  SelectionActionsBindings & {
    graph: GraphData;
    onSelectNode: (id: string) => void;
    onSelectEdge: (id: string) => void;
  };

export function SidePanel({
  selectedNode,
  selectedEdge,
  selectionCounts,
  graph,
  onSelectNode,
  onSelectEdge,
  ...bindings
}: SidePanelProps) {
  const view = sidePanelView({ selectedNode, selectedEdge, selectionCounts });
  const t = useTranslations("Graph.properties");
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingFocusId = useRef<string | null>(null);
  const singleSelectionId =
    view.kind === "node"
      ? view.node.id
      : view.kind === "edge"
        ? view.edge.id
        : undefined;
  useEffect(() => {
    if (pendingFocusId.current === null) return;
    if (pendingFocusId.current === singleSelectionId) {
      contentRef.current
        ?.querySelector<HTMLElement>("[data-selection-header]")
        ?.focus();
    }
    pendingFocusId.current = null;
  }, [singleSelectionId]);
  const selectElement = (entry: GraphElementEntry) => {
    pendingFocusId.current = entry.id;
    if (entry.kind === "edge") onSelectEdge(entry.id);
    else onSelectNode(entry.id);
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-4 py-2">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
      </div>
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {view.kind === "outline" ? (
          <p className="text-xs text-muted-foreground">{t("empty")}</p>
        ) : view.kind === "bulk" ? (
          <BulkSelection counts={view.counts} graph={graph} {...bindings} />
        ) : (
          <SelectionProperties
            selection={view}
            graph={graph}
            onSelectRelated={selectElement}
            {...bindings}
          />
        )}
      </div>
      {view.kind === "outline" ? null : (
        <SelectionActions selection={view} nodes={graph.nodes} {...bindings} />
      )}
    </aside>
  );
}
