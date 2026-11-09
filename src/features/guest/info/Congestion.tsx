"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { orpc } from "@/lib/orpc";
import { useGuestPolling } from "../useGuestPolling";
import { type CongestionArea, CongestionView } from "./CongestionView";
import { groupCrowdByFloor } from "./groupCrowd";
import { showOnGuideMap, useGuideMapPointIds } from "./guideMapLinkStore";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function Congestion({ eventId }: GuestInfoComponentProps) {
  // TODO: エリアをタップして詳細（人数など）を表示する対応は将来追加。
  const t = useTranslations("Guest");
  const locale = useLocale();
  const crowd = useGuestPolling(
    useCallback(
      () => orpc.guest.getCrowd({ eventId, language: locale }),
      [eventId, locale],
    ),
  );

  // 同じ場所・同じ段階で階だけ違うものは 1 行にまとめる（例：1F〜6F エレベーター前）
  const groups = groupCrowdByFloor(
    crowd.status === "ready" ? crowd.data.crowd : [],
    {
      range: (from, to) => t("congestion.floorRange", { from, to }),
      join: (parts) => parts.join(t("congestion.floorJoin")),
    },
  );
  // 地図上にある場所（ポイント）は「地図で見る」で案内マップに出せる。id は "pointId:<ID>" か "routeId:<ID>"。
  // まとめた行は、地図上にあるうちいちばん下の階の場所を見せる
  const mapPointIds = useGuideMapPointIds();
  const areas: CongestionArea[] = groups.map((group) => {
    const pointId = group.members
      .map((m) =>
        m.id.startsWith("pointId:") ? m.id.slice("pointId:".length) : "",
      )
      .find((id) => id && mapPointIds.has(id));
    return {
      id: group.members.map((m) => m.id).join("|"),
      name: group.name,
      level: group.level,
      danger: group.danger,
      mapAction: pointId
        ? {
            ariaLabel: t("showOnMapLabel", { place: group.name }),
            onPress: () => showOnGuideMap(pointId),
          }
        : undefined,
    };
  });
  const takenAt = crowd.status === "ready" ? crowd.data.takenAt : null;
  const message = {
    loading: t("loading"),
    error: t("loadError"),
    ready: areas.length === 0 ? t("congestion.empty") : undefined,
  }[crowd.status];

  return (
    <CongestionView
      areas={areas}
      title={t("congestion.title")}
      levelLabels={{
        low: t("congestion.levels.low"),
        mid: t("congestion.levels.mid"),
        high: t("congestion.levels.high"),
      }}
      dangerLabel={t("congestion.danger")}
      updatedAt={
        takenAt
          ? t("congestion.updatedAt", {
              time: new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(takenAt)),
            })
          : undefined
      }
      message={message}
    />
  );
}

export default defineGuestInfoComponent("congestion", Congestion, {
  pageComponent: "crowd",
});
