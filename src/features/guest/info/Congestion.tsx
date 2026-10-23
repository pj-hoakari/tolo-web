"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { orpc } from "@/lib/orpc";
import { useGuestPolling } from "../useGuestPolling";
import { CongestionView } from "./CongestionView";
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

  const areas = crowd.status === "ready" ? crowd.data.crowd : [];
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
