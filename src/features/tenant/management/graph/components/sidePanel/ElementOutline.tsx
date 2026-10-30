import { useTranslations } from "next-intl";
import {
  ListBox,
  ListBoxHeader,
  ListBoxItem,
  ListBoxSection,
} from "@/components/ui/list-box";
import type { GraphData } from "../../type";
import { outlineSections } from "../../utils/elementOutline";
import type { GraphElementEntry } from "../../utils/relatedElements";

const entryKey = (entry: GraphElementEntry) => `${entry.kind}:${entry.id}`;

export function ElementOutline({
  graph,
  onSelect,
  "aria-labelledby": labelledBy,
}: {
  graph: GraphData;
  onSelect: (entry: GraphElementEntry) => void;
  "aria-labelledby": string;
}) {
  const t = useTranslations("Graph.sidePanel.sections");
  const sections = outlineSections(graph);
  const entries = new Map(
    sections.flatMap((section) =>
      section.entries.map((entry) => [entryKey(entry), entry] as const),
    ),
  );

  return (
    <ListBox
      aria-labelledby={labelledBy}
      selectionMode="none"
      onAction={(key) => {
        const entry = entries.get(String(key));
        if (entry) onSelect(entry);
      }}
      className="-mx-2 rounded-none border-0 bg-transparent p-0 shadow-none"
    >
      {sections.map((section) => (
        <ListBoxSection key={section.id} id={section.id} className="pb-2">
          <ListBoxHeader className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {t(section.id)}
          </ListBoxHeader>
          {section.entries.map((entry) => (
            <ListBoxItem key={entryKey(entry)} id={entryKey(entry)}>
              {entry.label}
            </ListBoxItem>
          ))}
        </ListBoxSection>
      ))}
    </ListBox>
  );
}
