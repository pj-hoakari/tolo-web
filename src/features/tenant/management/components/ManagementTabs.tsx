"use client";

import { useTranslations } from "next-intl";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { ConnectedEdges } from "@/features/tenant/webrtc/components/ConnectedEdges";
import { type GraphData, GraphViewer } from "../graph";
import { graphEditPath } from "../routes";

type TabId = "graph" | "edges";

type Props = {
  tenantId: string;
  eventId: string;
  initialGraph?: GraphData;
};

const TAB_IDS: TabId[] = ["graph", "edges"];

export function ManagementTabs({ tenantId, eventId, initialGraph }: Props) {
  const t = useTranslations("Management");

  return (
    <Tabs
      defaultSelectedKey="graph"
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <TabList
        aria-label={t("tabsLabel")}
        className="mx-10 mt-2 flex-none self-start"
      >
        {TAB_IDS.map((id) => (
          <Tab key={id} id={id}>
            {t(`tabs.${id}`)}
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
              editHref={graphEditPath(eventId)}
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
