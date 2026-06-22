"use client";

import { useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { type Lang, messages } from "../i18n/messages";
import { StaffMessageBellView } from "./StaffMessageBellView";
import type { StaffMessage } from "./StaffMessageView";

export type StaffMessageBellProps = {
  tenantId: string;
  eventId: string;
};

/** 言語ごとのフィールドを持つ生のお知らせ（本来は API レスポンス） */
type RawStaffMessage = {
  id: string;
  deliveredAt: string;
  body: Record<Lang, string>;
  staffName: Record<Lang, string>;
  staffRole: Record<Lang, string>;
};

// --- ダミーのお知らせ（本来は API から取得する） ---
const rawMessages: RawStaffMessage[] = [
  {
    id: "msg-2",
    deliveredAt: "2026-06-15T14:30:00+09:00",
    body: {
      ja: "東ゲート付近が大変混雑しています。お急ぎの方は西ゲートのご利用をおすすめします。",
      en: "The east gate area is very crowded. If you're in a hurry, we recommend using the west gate.",
      zh: "东门附近非常拥挤。赶时间的来宾建议使用西门。",
    },
    staffName: { ja: "山田 太郎", en: "Taro Yamada", zh: "山田太郎" },
    staffRole: { ja: "会場スタッフ", en: "Venue staff", zh: "会场工作人员" },
  },
  {
    id: "msg-1",
    deliveredAt: "2026-06-15T13:05:00+09:00",
    body: {
      ja: "開演時刻が 15:00 から 15:30 に変更となりました。ご了承ください。",
      en: "The start time has changed from 15:00 to 15:30. Thank you for your understanding.",
      zh: "演出开始时间已从 15:00 改为 15:30，敬请谅解。",
    },
    staffName: { ja: "佐藤 花子", en: "Hanako Sato", zh: "佐藤花子" },
    staffRole: { ja: "運営責任者", en: "Event manager", zh: "运营负责人" },
  },
];

export function StaffMessageBell(_props: StaffMessageBellProps) {
  // TODO: _props.tenantId / _props.eventId でスタッフメッセージ API を購読する。
  //       新着が配信されたら自動更新し、未読件数（id ベースで既読判定）をバッジに反映する。
  const { lang } = useLanguage();
  const t = messages[lang].staffMessage;

  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<readonly string[]>([]);

  // 表示言語に応じて各フィールドを解決する
  const localizedMessages: StaffMessage[] = rawMessages.map((message) => ({
    id: message.id,
    deliveredAt: message.deliveredAt,
    body: message.body[lang],
    staffName: message.staffName[lang],
    staffRole: message.staffRole[lang],
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
      title={t.title}
      ariaOpen={t.ariaOpen}
      ariaClose={t.ariaClose}
      emptyText={t.empty}
      locale={t.locale}
    />
  );
}
