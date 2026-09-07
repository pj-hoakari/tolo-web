"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGraph } from "@/features/graph";
import { GraphGuideView } from "./GraphGuideView";
import { buildGuideGraph } from "./graphGuideModel";
import { findPath } from "./graphGuideRoute";
import { InfoCard } from "./InfoCard";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

/**
 * 会場グラフ（venue graph）を元に案内マップを表示するゲスト情報コンポーネント。
 * グラフの取得は `useGraph` に任せ、ここでは表示ロケールで案内モデルへ変換して描く。
 */
function GraphGuide({ tenantId, eventId }: GuestInfoComponentProps) {
  const t = useTranslations("Guest.graphGuide");
  const locale = useLocale();
  const result = useGraph({ tenantId, eventId });
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // 取得できたグラフを、表示ロケールで案内モデルへ変換する
  const model = useMemo(
    () =>
      result.status === "ready" ? buildGuideGraph(result.graph, locale) : null,
    [result.status, result.graph, locale],
  );

  // 現在地→選択した目的地の経路（グラフのエッジをたどる）
  const routeIds = useMemo(() => {
    if (!model?.start || !selectedGoalId) return [];
    return findPath(model.edges, model.start, selectedGoalId);
  }, [model, selectedGoalId]);

  return (
    <InfoCard title={t("title")}>
      {result.status === "loading" && (
        <p className="text-primary/55 text-sm">{t("loading")}</p>
      )}

      {result.status === "error" && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-primary/55 text-sm">{t("error")}</p>
          <Button size="sm" variant="secondary" onPress={result.refresh}>
            {t("retry")}
          </Button>
        </div>
      )}

      {model && (
        <GraphGuideView
          model={model}
          selectedGoalId={selectedGoalId}
          onSelectGoal={setSelectedGoalId}
          routeIds={routeIds}
          hint={t("hint")}
          currentLocationLabel={t("currentLocation")}
          destinationsLabel={t("destinationsLabel")}
        />
      )}
    </InfoCard>
  );
}

export default defineGuestInfoComponent("graph-guide", GraphGuide);
