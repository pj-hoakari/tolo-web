import { useTranslations } from "next-intl";
import { useState } from "react";
import { ListLayout, Virtualizer } from "react-aria-components";
import {
  Tree,
  TreeHeader,
  TreeItem,
  TreeItemContent,
  TreeItemExpandButton,
  TreeSection,
} from "@/components/ui/tree";
import { type GraphData, isGroupNode } from "../../type";
import { elementOutline, type OutlineItem } from "../../utils/elementOutline";
import { type GraphElementEntry, nodeEntry } from "../../utils/relatedElements";

const entryKey = (entry: GraphElementEntry) => `${entry.kind}:${entry.id}`;

export function ElementOutline({
  graph,
  onSelect,
  autoFocus,
  "aria-labelledby": labelledBy,
}: {
  graph: GraphData;
  onSelect: (entry: GraphElementEntry) => void;
  autoFocus: boolean;
  "aria-labelledby": string;
}) {
  const [focusFirstOnMount] = useState(autoFocus);
  const t = useTranslations("Graph.sidePanel");
  const { elements, routes } = elementOutline(graph);

  const renderItem = (item: OutlineItem) => (
    <TreeItem
      key={entryKey(item)}
      id={entryKey(item)}
      textValue={item.label}
      onAction={() => onSelect(item)}
      className="cursor-default text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <TreeItemContent>
        {({ hasChildItems }) => (
          <>
            {hasChildItems ? <TreeItemExpandButton /> : null}
            {item.label}
          </>
        )}
      </TreeItemContent>
      {item.children.map(renderItem)}
    </TreeItem>
  );

  return (
    <Virtualizer
      layout={ListLayout}
      layoutOptions={{
        estimatedRowHeight: 28,
        estimatedHeadingHeight: 32,
        gap: 4,
        padding: 4,
      }}
    >
      <Tree
        aria-labelledby={labelledBy}
        selectionMode="none"
        autoFocus={focusFirstOnMount && "first"}
        defaultExpandedKeys={graph.nodes
          .filter(isGroupNode)
          .map((group) => entryKey(nodeEntry(group)))}
        className="h-full p-0"
      >
        {elements.map(renderItem)}
        {routes.length > 0 ? (
          <TreeSection id="routes" className="pt-2">
            <TreeHeader className="px-1 py-1 text-xs font-medium text-muted-foreground">
              {t("routes")}
            </TreeHeader>
            {routes.map((route) => renderItem({ ...route, children: [] }))}
          </TreeSection>
        ) : null}
      </Tree>
    </Virtualizer>
  );
}
