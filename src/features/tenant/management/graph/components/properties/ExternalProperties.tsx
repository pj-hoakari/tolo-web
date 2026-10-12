import { useTranslations } from "next-intl";
import type { GraphNodeType } from "../../type";
import { PropertyNotice } from "./PropertyNotice";
import { SelectionHeader } from "./SelectionHeader";

export type ExternalPropertiesProps = {
  node: GraphNodeType;
};

export function ExternalProperties({ node }: ExternalPropertiesProps) {
  const tDescription = useTranslations("Graph.nodeTypeDescription");
  const tNotice = useTranslations("Graph.notices");

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <SelectionHeader kind="node" id={node.id} />
      <p className="font-semibold text-foreground text-sm">{node.data.label}</p>
      <p className="text-muted-foreground text-xs">
        {tDescription("EXTERNAL")}
      </p>
      {node.data.notices?.map((notice) => (
        <PropertyNotice
          key={notice.messageKey}
          level={notice.level}
          message={tNotice(notice.messageKey)}
        />
      ))}
    </div>
  );
}
