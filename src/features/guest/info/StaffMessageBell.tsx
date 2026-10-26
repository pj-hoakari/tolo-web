"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { orpc } from "@/lib/orpc";
import { useGuestPolling } from "../useGuestPolling";
import { StaffMessageBellView } from "./StaffMessageBellView";
import type { StaffMessage } from "./StaffMessageView";

export type StaffMessageBellProps = {
  tenantId: string;
  eventId: string;
};

function readIdsKey(eventId: string): string {
  return `tolo:guest-read:${eventId}`;
}

function loadReadIds(eventId: string): string[] {
  try {
    const ids: unknown = JSON.parse(
      localStorage.getItem(readIdsKey(eventId)) ?? "[]",
    );
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function saveReadIds(eventId: string, ids: string[]) {
  try {
    localStorage.setItem(readIdsKey(eventId), JSON.stringify(ids));
  } catch {}
}

export function StaffMessageBell({ eventId }: StaffMessageBellProps) {
  const t = useTranslations("Guest.staffMessage");
  const locale = useLocale();

  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => loadReadIds(eventId));
  const result = useGuestPolling(
    useCallback(() => orpc.guest.listGuestMessages({ eventId }), [eventId]),
  );

  const messages: StaffMessage[] =
    result.status === "ready"
      ? result.data.messages
          .map((message) => ({
            id: message.messageId,
            body: message.body,
            deliveredAt: message.sentAt,
          }))
          .reverse()
      : [];

  const unreadCount = messages.filter(
    (message) => !readIds.includes(message.id),
  ).length;

  const handleOpenChange = (next: boolean) => {
    setIsOpen(next);
    // 開いたタイミングで既読にする
    if (next) {
      const ids = messages.map((message) => message.id);
      setReadIds(ids);
      saveReadIds(eventId, ids);
    }
  };

  return (
    <StaffMessageBellView
      messages={messages}
      unreadCount={unreadCount}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title={t("title")}
      ariaOpen={t("ariaOpen")}
      emptyText={t("empty")}
      locale={locale}
    />
  );
}
