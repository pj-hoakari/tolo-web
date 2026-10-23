"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { orpc } from "@/lib/orpc";
import { useGuestPolling } from "../useGuestPolling";
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

  const gateList = new Intl.ListFormat(locale);
  const queues: QueueSummary[] =
    result.status === "ready"
      ? result.data.queues.map((queue) => {
          const gates = queue.gates
            .filter((gate) => gate.recommended)
            .map((gate) => gate.name);
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
