"use client";

import { Compass, MapPin, Navigation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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

  const route = useMemo(
    () => (startId && goalId ? routePoints(model, startId, goalId) : []),
    [model, startId, goalId],
  );
  const goalLabel = model.goals.find((g) => g.id === goalId)?.label ?? null;

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
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-primary/55 text-xs">
            <MapPin className="size-3.5" />
            {t("currentLocation")}
          </p>
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
        </div>

        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-primary/55 text-xs">
            <Navigation className="size-3.5" />
            {t("destinationsLabel")}
          </p>
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
        </div>

        {route.length >= 2 ? (
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5"
            onPress={() => setOpen(true)}
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
          destinationLabel={goalLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </InfoCard>
  );
}

export default defineGuestInfoComponent(
  "graph-compass-guide",
  GraphCompassGuide,
);
