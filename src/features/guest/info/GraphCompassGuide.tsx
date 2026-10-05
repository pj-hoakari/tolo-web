"use client";

import { Compass, MapPin, Navigation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Disclosure,
  DisclosureGroup,
  DisclosureHeader,
  DisclosurePanel,
} from "@/components/ui/disclosure";
import { cn } from "@/lib/utils";
import { CompassGuide } from "./CompassGuide";
import {
  buildNav,
  type GraphData,
  type GraphicalInfo,
  routePoints,
} from "./graphicalInfoNav";
import { InfoCard } from "./InfoCard";
import sampleGraph from "./sampleGraph.json";
import sampleInfo from "./sampleGraphicalInfo.json";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";
import { useHeading } from "./useHeading";

/**
 * 会場グラフ＋graphical_info を読み込み、現在地と目的地を選んで
 * スマホの方位センサーでコンパス道案内する画面。
 *
 * TODO: _props.tenantId / _props.eventId で graph / graphical_info を API から取得する。
 *       いまはリポジトリ同梱のサンプル JSON を読み込んで表示している。
 */
function GraphCompassGuide(_props: GuestInfoComponentProps) {
  const t = useTranslations("Guest.guideMap");
  const locale = useLocale();

  const model = useMemo(
    () =>
      buildNav(
        sampleGraph as unknown as GraphData,
        sampleInfo as GraphicalInfo,
        locale,
      ),
    [locale],
  );

  const [startId, setStartId] = useState<string>(
    () => model.starts[0]?.id ?? "",
  );
  const [goalId, setGoalId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // 方位センサー。開くタップ内で開始する（iOS の許可はジェスチャ必須）
  const compass = useHeading();

  const openCompass = () => {
    compass.start();
    setOpen(true);
  };
  const closeCompass = () => {
    compass.stop();
    setOpen(false);
  };

  const route = useMemo(
    () => (startId && goalId ? routePoints(model, startId, goalId) : []),
    [model, startId, goalId],
  );
  const goalLabel = model.goals.find((g) => g.id === goalId)?.label ?? null;

  // ミニマップに薄く描く、出発フロアの地点（位置関係の把握用）
  const mapNodes = useMemo(() => {
    const floor = model.nodes.find((n) => n.id === startId)?.floor;
    return model.nodes
      .filter((n) => n.floor === floor)
      .map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
  }, [model, startId]);

  const chip = (selected: boolean) =>
    cn(
      "h-7 rounded-full border-primary/12 px-3 text-sm",
      selected
        ? "bg-accent text-secondary"
        : "text-primary/70 hover:text-accent",
    );

  return (
    <InfoCard title={t("compass.navTitle")}>
      <div className="space-y-3">
        <DisclosureGroup
          defaultExpandedKeys={["start"]}
          className="rounded-lg border border-primary/12"
        >
          <Disclosure
            id="start"
            className="border-primary/12 border-b px-3 last:border-b-0"
          >
            <DisclosureHeader className="py-2.5 font-medium text-sm">
              <span className="flex flex-1 items-center justify-between gap-2 pr-2">
                <span className="flex items-center gap-1.5 text-primary/70">
                  <MapPin className="size-3.5" />
                  {t("currentLocation")}
                </span>
                <span className="truncate font-normal text-primary/90 text-sm">
                  {model.starts.find((n) => n.id === startId)?.label ?? "—"}
                </span>
              </span>
            </DisclosureHeader>
            <DisclosurePanel className="pb-3">
              <div className="flex flex-wrap gap-1.5">
                {model.starts.map((n) => (
                  <Button
                    key={n.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={chip(n.id === startId)}
                    onPress={() => setStartId(n.id)}
                  >
                    {n.label}
                  </Button>
                ))}
              </div>
            </DisclosurePanel>
          </Disclosure>

          <Disclosure id="goal" className="px-3">
            <DisclosureHeader className="py-2.5 font-medium text-sm">
              <span className="flex flex-1 items-center justify-between gap-2 pr-2">
                <span className="flex items-center gap-1.5 text-primary/70">
                  <Navigation className="size-3.5" />
                  {t("destinationsLabel")}
                </span>
                <span className="truncate font-normal text-primary/90 text-sm">
                  {goalLabel ?? "—"}
                </span>
              </span>
            </DisclosureHeader>
            <DisclosurePanel className="pb-3">
              <div className="flex flex-wrap gap-1.5">
                {model.goals.map((n) => (
                  <Button
                    key={n.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={chip(n.id === goalId)}
                    onPress={() => setGoalId(n.id)}
                  >
                    {n.label}
                  </Button>
                ))}
              </div>
            </DisclosurePanel>
          </Disclosure>
        </DisclosureGroup>

        {route.length >= 2 ? (
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5"
            onPress={openCompass}
          >
            <Compass className="size-4" />
            {t("compass.open")}
          </Button>
        ) : (
          <p className="text-primary/45 text-sm">{t("compass.navHint")}</p>
        )}
      </div>

      {open && route.length >= 2 && (
        <CompassGuide
          route={route}
          north={model.north}
          metersPerPx={model.metersPerPx}
          mapNodes={mapNodes}
          destinationLabel={goalLabel}
          heading={compass.heading}
          sensorState={compass.state}
          onEnableSensor={compass.start}
          onClose={closeCompass}
        />
      )}
    </InfoCard>
  );
}

export default defineGuestInfoComponent(
  "graph-compass-guide",
  GraphCompassGuide,
);
