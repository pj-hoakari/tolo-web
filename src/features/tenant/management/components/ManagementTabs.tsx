"use client";

import { useRouter } from "next/navigation";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { ConnectedEdges } from "@/features/tenant/webrtc/components/ConnectedEdges";
import { type GraphData, GraphViewer } from "../graphEditor";
import { graphEditPath } from "../routes";

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
  const router = useRouter();

  return (
    <Tabs
      defaultSelectedKey="graph"
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <TabList
        aria-label="管理ビュー切り替え"
        className="mx-10 mt-2 flex-none self-start"
      >
        {TABS.map((t) => (
          <Tab key={t.id} id={t.id}>
            {t.label}
          </Tab>
        ))}
      </TabList>

      <div className="min-h-0 flex-1 overflow-hidden px-2 py-2">
        {/* グラフは紐づけの状態を保持するためタブ非選択時もマウントしたまま隠す */}
        <TabPanel
          id="graph"
          shouldForceMount
          className="h-full data-inert:hidden"
        >
          <div className="h-full w-full overflow-hidden rounded-lg border border-border bg-background">
            <GraphViewer
              tenantId={tenantId}
              eventId={eventId}
              initialGraph={initialGraph}
              onEditGraph={() => router.push(graphEditPath(eventId))}
            />
          </div>
        </TabPanel>

        <TabPanel
          id="edges"
          className="flex h-full w-full flex-col items-center gap-4 overflow-y-auto"
        >
          <ConnectedEdges tenantId={tenantId} eventId={eventId} />
        </TabPanel>
      </div>
    </Tabs>
  );
}
