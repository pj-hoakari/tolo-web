import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import type {
  GraphElementEntry,
  GroupRelations,
  NodeRelations,
} from "../../utils/relatedElements";

export type RelatedElementLinksProps = {
  related: NodeRelations | GroupRelations;
  onSelect: (entry: GraphElementEntry) => void;
};

export function RelatedElementLinks({
  related,
  onSelect,
}: RelatedElementLinksProps) {
  const t = useTranslations("Graph.properties.related");
  const sections = [
    { title: t("parent"), entries: related.parent ? [related.parent] : [] },
    related.kind === "node"
      ? { title: t("routes"), entries: related.routes }
      : { title: t("children"), entries: related.children },
  ].filter((section) => section.entries.length > 0);

  return sections.map((section) => (
    <RelatedElementList key={section.title} {...section} onSelect={onSelect} />
  ));
}

function RelatedElementList({
  title,
  entries,
  onSelect,
}: {
  title: string;
  entries: GraphElementEntry[];
  onSelect: (entry: GraphElementEntry) => void;
}) {
  const titleId = useId();

  return (
    <div className="flex flex-col gap-1">
      <p id={titleId} className="text-[11px] text-muted-foreground">
        {title}
      </p>
      <ul aria-labelledby={titleId} className="flex flex-col items-start gap-1">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Button
              variant="link"
              className="h-auto p-0 text-left text-xs whitespace-normal underline"
              onPress={() => onSelect(entry)}
            >
              {entry.label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
