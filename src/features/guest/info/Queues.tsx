"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { orpc } from "@/lib/orpc";
import { useGuestPolling } from "../useGuestPolling";
import { showOnGuideMap, useGuideMapPointIds } from "./guideMapLinkStore";
import { type QueueSummary, QueuesView } from "./QueuesView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function Queues({ eventId }: GuestInfoComponentProps) {
  const t = useTranslations("Guest");
  const locale = useLocale();
  const result = useGuestPolling(
    useCallback(
      () => orpc.guest.getQueues({ eventId, language: locale }),
      [eventId, locale],
    ),
  );

  // 地図上にある入口（おすすめを優先）は「地図で見る」で案内マップに出せる
  const mapPointIds = useGuideMapPointIds();
  const gateList = new Intl.ListFormat(locale);
  const queues: QueueSummary[] =
    result.status === "ready"
      ? result.data.queues.map((queue) => {
          const gates = queue.gates
            .filter((gate) => gate.recommended)
            .map((gate) => gate.name);
          const gateOnMap =
            queue.gates.find(
              (gate) => gate.recommended && mapPointIds.has(gate.pointId),
            ) ?? queue.gates.find((gate) => mapPointIds.has(gate.pointId));
          return {
            id: queue.queueId,
            name: queue.name,
            waitTime: t("queues.waitTime", {
              minutes: Math.ceil(queue.waitTimeMinutes),
            }),
            recommendedGates:
              gates.length > 0
                ? t("queues.recommendedGates", {
                    gates: gateList.format(gates),
                  })
                : undefined,
            mapAction: gateOnMap
              ? {
                  label: t("showOnMap"),
                  ariaLabel: t("showOnMapLabel", { place: gateOnMap.name }),
                  onPress: () => showOnGuideMap(gateOnMap.pointId),
                }
              : undefined,
          };
        })
      : [];
  const message = {
    loading: t("loading"),
    error: t("loadError"),
    ready: queues.length === 0 ? t("queues.empty") : undefined,
  }[result.status];

  return (
    <QueuesView queues={queues} title={t("queues.title")} message={message} />
  );
}

export default defineGuestInfoComponent("queues", Queues, {
  pageComponent: "queues",
});
