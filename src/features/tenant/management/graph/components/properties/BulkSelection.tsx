import { useTranslations } from "next-intl";
import type { GraphData } from "../../type";
import type { SelectionCounts } from "../sidePanel/sidePanelView";
import { BulkProperties, type BulkPropertiesBindings } from "./BulkProperties";

export function BulkSelection({
  counts,
  graph,
  ...bindings
}: BulkPropertiesBindings & { counts: SelectionCounts; graph: GraphData }) {
  const t = useTranslations("Graph.properties");

  return (
    <div className="space-y-3">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>{t("selectedNodes", { count: counts.nodes })}</p>
        <p>{t("selectedEdges", { count: counts.edges })}</p>
        <p>{t("selectedGroups", { count: counts.groups })}</p>
      </div>
      <BulkProperties graph={graph} {...bindings} />
    </div>
  );
}
