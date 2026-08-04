"use client";

import type { Messages } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { StaffMessageBellView } from "./StaffMessageBellView";
import type { StaffMessage } from "./StaffMessageView";

export type StaffMessageBellProps = {
  tenantId: string;
  eventId: string;
};

/** 本文・氏名・役職を解決できるお知らせ id */
type SampleId = keyof Messages["Guest"]["staffMessage"]["samples"];

/** 本文・氏名・役職は Guest.staffMessage.samples から id をキーに解決する（本来は API レスポンス） */
type RawStaffMessage = {
  id: SampleId;
  deliveredAt: string;
};

// --- ダミーのお知らせ（本来は API から取得する） ---
const rawMessages: RawStaffMessage[] = [
  { id: "msg-2", deliveredAt: "2026-06-15T14:30:00+09:00" },
  { id: "msg-1", deliveredAt: "2026-06-15T13:05:00+09:00" },
];

export function StaffMessageBell(_props: StaffMessageBellProps) {
  // TODO: _props.tenantId / _props.eventId でスタッフメッセージ API を購読する。
  //       新着が配信されたら自動更新し、未読件数（id ベースで既読判定）をバッジに反映する。
  const t = useTranslations("Guest.staffMessage");
  const locale = useLocale();

  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<readonly string[]>([]);

  // 表示言語に応じて各フィールドを解決する
  const localizedMessages: StaffMessage[] = rawMessages.map((message) => ({
    id: message.id,
    deliveredAt: message.deliveredAt,
    body: t(`samples.${message.id}.body`),
    staffName: t(`samples.${message.id}.staffName`),
    staffRole: t(`samples.${message.id}.staffRole`),
  }));

  const unreadCount = rawMessages.filter(
    (message) => !readIds.includes(message.id),
  ).length;

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      // 開いたタイミングで既読にする
      if (next) {
        setReadIds(rawMessages.map((message) => message.id));
      }
      return next;
    });
  };

  return (
    <StaffMessageBellView
      messages={localizedMessages}
      unreadCount={unreadCount}
      isOpen={isOpen}
      onToggle={handleToggle}
      title={t("title")}
      ariaOpen={t("ariaOpen")}
      ariaClose={t("ariaClose")}
      emptyText={t("empty")}
      locale={locale}
    />
  );
}
