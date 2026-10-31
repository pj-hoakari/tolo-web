import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { type Ref, useEffect, useId, useImperativeHandle, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { ElementOutline } from "./ElementOutline";
import { type SidePanelSelection, sidePanelView } from "./sidePanelView";

export type SidePanelProps = SidePanelSelection &
  SelectionPropertiesBindings &
  BulkPropertiesBindings &
  SelectionActionsBindings & {
    graph: GraphData;
    onSelectNode: (id: string) => void;
    onSelectEdge: (id: string) => void;
    onClearSelection: () => void;
    ref?: Ref<SidePanelHandle>;
  };

export type SidePanelHandle = { backToOutline: () => void };

type FocusRequest = { kind: "outline" } | { kind: "element"; id: string };

export function SidePanel({
  selectedNode,
  selectedEdge,
  selectionCounts,
  graph,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  ref,
  ...bindings
}: SidePanelProps) {
  const view = sidePanelView({ selectedNode, selectedEdge, selectionCounts });
  const t = useTranslations("Graph");
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<FocusRequest | null>(null);
  const singleSelectionId =
    view.kind === "node"
      ? view.node.id
      : view.kind === "edge"
        ? view.edge.id
        : undefined;
  useEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = null;
    if (view.kind === "outline" || request?.kind !== "element") return;
    if (request.id === singleSelectionId) {
      contentRef.current
        ?.querySelector<HTMLElement>("[data-selection-header]")
        ?.focus();
    }
  }, [view.kind, singleSelectionId]);
  const selectElement = (entry: GraphElementEntry) => {
    focusRequest.current = { kind: "element", id: entry.id };
    if (entry.kind === "edge") onSelectEdge(entry.id);
    else onSelectNode(entry.id);
  };
  const backToOutline = () => {
    focusRequest.current = { kind: "outline" };
    onClearSelection();
  };
  useImperativeHandle(ref, () => ({ backToOutline }));

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex h-10 items-center justify-between gap-2 border-b border-border px-4">
        <p id={titleId} className="text-sm font-semibold text-foreground">
          {view.kind === "outline"
            ? t("sidePanel.outline")
            : t("properties.title")}
        </p>
        {view.kind === "outline" ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onPress={backToOutline}
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {t("sidePanel.backToOutline")}
          </Button>
        )}
      </div>
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {view.kind === "outline" ? (
          <ElementOutline
            graph={graph}
            onSelect={selectElement}
            autoFocus={focusRequest.current?.kind === "outline"}
            aria-labelledby={titleId}
          />
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
