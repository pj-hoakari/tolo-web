import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  hasNodeTypeFlag,
  NODE_TYPE_FLAGS,
  type NodeTypeFlag,
} from "../../nodeTypes";
import type { EdgeDirection, GraphData } from "../../type";
import { isExternalNode, isPointNode } from "../../type";
import {
  type BulkEditResult,
  bulkPropertyAvailability,
  commonValue,
} from "../../utils/bulkProperties";
import { EdgeDirectionField } from "./EdgeDirectionField";
import { EdgeReverseButton } from "./EdgeReverseButton";

export type BulkPropertiesBindings = {
  onSetSelectedNodeFlag: (flag: NodeTypeFlag, enabled: boolean) => void;
  onSetSelectedEdgeDirection: (direction: EdgeDirection) => void;
  onReverseSelectedEdges: () => void;
  bulkResult: BulkEditResult | null;
};

function BulkReasons({ reasons }: { reasons: BulkEditResult["reasons"] }) {
  const t = useTranslations("Graph.properties.bulk");
  const tNotice = useTranslations("Graph.notices");
  const unique = new Map<string, BulkEditResult["reasons"][number]>();
  for (const reason of reasons) {
    const key = `${reason.kind}:${reason.messageKey}`;
    const previous = unique.get(key);
    if (!previous || previous.count < reason.count) unique.set(key, reason);
  }
  return [...unique.values()].map((reason) => (
    <p key={`${reason.kind}:${reason.messageKey}`}>
      {t("reasonCount", {
        count: reason.count,
        reason:
          reason.kind === "notice"
            ? tNotice(reason.messageKey)
            : t(`reasons.${reason.messageKey}`),
      })}
    </p>
  ));
}

function BulkFlagField({
  graph,
  flag,
  value,
  onChange,
}: {
  graph: GraphData;
  flag: NodeTypeFlag;
  value: boolean | null;
  onChange: (flag: NodeTypeFlag, enabled: boolean) => void;
}) {
  const tFlag = useTranslations("Graph.nodeTypeFlag");
  const tDescription = useTranslations("Graph.nodeTypeFlagDescription");
  const t = useTranslations("Graph.properties.bulk");
  // 中間状態が残った場合にも次のクリックで解除を指定できる。
  const [lastRequested, setLastRequested] = useState<boolean | null>(null);
  const reasonId = useId();
  const next = value === null ? lastRequested !== true : !value;
  const availability = bulkPropertyAvailability(graph, {
    kind: "nodeFlag",
    flag,
    enabled: next,
  });
  return (
    <div className={cn("space-y-1", flag === "destination" && "ml-6")}>
      <Checkbox
        isSelected={value === true}
        isIndeterminate={value === null}
        isDisabled={!availability.available}
        aria-describedby={!availability.available ? reasonId : undefined}
        onChange={() => {
          setLastRequested(next);
          onChange(flag, next);
        }}
        className="items-start"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">
            {tFlag(flag)}
          </span>
          <span className="text-[10px] font-normal text-muted-foreground">
            {tDescription(flag)}
          </span>
        </span>
      </Checkbox>
      {value === null ? (
        <p className="text-xs text-muted-foreground">{t("mixed")}</p>
      ) : null}
      {!availability.available ? (
        <div id={reasonId} className="text-xs text-muted-foreground">
          <BulkReasons reasons={availability.reasons} />
        </div>
      ) : null}
    </div>
  );
}

export function BulkProperties({
  graph,
  onSetSelectedNodeFlag,
  onSetSelectedEdgeDirection,
  onReverseSelectedEdges,
  bulkResult,
}: BulkPropertiesBindings & { graph: GraphData }) {
  const t = useTranslations("Graph.properties.bulk");
  const points = graph.nodes
    .filter(isPointNode)
    .filter((n) => n.selected && !isExternalNode(n));
  const edges = graph.edges.filter((e) => e.selected);
  const selectionKey = JSON.stringify([
    graph.nodes
      .filter((n) => n.selected)
      .map((n) => n.id)
      .toSorted(),
    edges.map((e) => e.id).toSorted(),
  ]);
  const direction = commonValue(edges.map((e) => e.data?.direction ?? "both"));
  const both = bulkPropertyAvailability(graph, {
    kind: "edgeDirection",
    direction: "both",
  });
  const oneway = bulkPropertyAvailability(graph, {
    kind: "edgeDirection",
    direction: "oneway",
  });
  const reverse = bulkPropertyAvailability(graph, { kind: "reverseEdges" });
  return (
    <div className="space-y-3">
      {points.length > 0 ? (
        <section
          aria-label={t("points", { count: points.length })}
          className="space-y-3 rounded-md border border-border p-3"
        >
          <h3 className="text-sm font-semibold">
            {t("points", { count: points.length })}
          </h3>
          {NODE_TYPE_FLAGS.map((flag) => (
            <BulkFlagField
              key={`${selectionKey}:${flag}`}
              graph={graph}
              flag={flag}
              value={commonValue(
                points.map((n) => hasNodeTypeFlag(n.data.nodeType, flag)),
              )}
              onChange={onSetSelectedNodeFlag}
            />
          ))}
        </section>
      ) : null}
      {edges.length > 0 ? (
        <section
          aria-label={t("edges", { count: edges.length })}
          className="space-y-3 rounded-md border border-border p-3"
        >
          <h3 className="text-sm font-semibold">
            {t("edges", { count: edges.length })}
          </h3>
          {direction === null ? (
            <p className="text-xs text-muted-foreground">{t("mixed")}</p>
          ) : null}
          <EdgeDirectionField
            value={direction}
            bothDisabled={!both.available}
            onewayDisabled={!oneway.available}
            onChange={onSetSelectedEdgeDirection}
          />
          {!both.available || !oneway.available ? (
            <div className="text-xs text-muted-foreground">
              <BulkReasons
                reasons={[
                  ...(!both.available ? both.reasons : []),
                  ...(!oneway.available ? oneway.reasons : []),
                ]}
              />
            </div>
          ) : null}
          <EdgeReverseButton
            isDisabled={!reverse.available}
            onPress={onReverseSelectedEdges}
          />
          {!reverse.available ? (
            <div className="text-xs text-muted-foreground">
              <BulkReasons reasons={reverse.reasons} />
            </div>
          ) : null}
        </section>
      ) : null}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="space-y-1 text-xs text-muted-foreground"
      >
        {bulkResult ? (
          <>
            <p>
              {t("result", {
                changed: bulkResult.changedCount,
                skipped: bulkResult.skippedCount,
              })}
            </p>
            <BulkReasons reasons={bulkResult.reasons} />
          </>
        ) : null}
      </div>
    </div>
  );
}
