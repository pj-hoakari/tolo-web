"use client";

import { useId, useState } from "react";
import { ConnectedEdges } from "@/features/tenant/webrtc/components/ConnectedEdges";
import type { GraphData } from "../type";
import { GraphEditor } from "./GraphEditor";

type TabId = "graph" | "edges";

type Props = {
  tenantId: string;
  eventId: string;
  initialGraph?: GraphData;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "graph", label: "会場グラフ" },
  { id: "edges", label: "接続エッジ" },
];

export function ManagementTabs({ tenantId, eventId, initialGraph }: Props) {
  const [active, setActive] = useState<TabId>("graph");
  const baseId = useId();
  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div
        role="tablist"
        aria-label="管理ビュー切り替え"
        className="flex flex-none gap-1 border-zinc-200 border-b px-10"
      >
        {TABS.map((t) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              id={tabId(t.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              onClick={() => setActive(t.id)}
              className={[
                "-mb-px border-b-2 px-4 py-2.5 font-medium text-sm transition",
                selected
                  ? "border-sky-600 text-sky-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-700",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2 py-2">
        <div
          role="tabpanel"
          id={panelId("graph")}
          aria-labelledby={tabId("graph")}
          hidden={active !== "graph"}
          className="h-full"
        >
          <div className="h-full w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
            <GraphEditor initialGraph={initialGraph} />
          </div>
        </div>

        {active === "edges" ? (
          <div
            role="tabpanel"
            id={panelId("edges")}
            aria-labelledby={tabId("edges")}
            className="flex h-full w-full flex-col items-center gap-4 overflow-y-auto"
          >
            <ConnectedEdges tenantId={tenantId} eventId={eventId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
