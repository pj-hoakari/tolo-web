"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { type Lang, messages } from "../i18n/messages";
import { FloorView } from "./FloorView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

// 現在のフロアの表示名（言語ごと）
const floorName: Record<Lang, string> = { ja: "1F", en: "1F", zh: "1层" };

function Floor(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId で現在のフロア番号・表示名（言語ごと）を取得する。
  //       案内マップと連動して表示フロアを切り替える。
  const { lang } = useLanguage();

  return (
    <FloorView floorName={floorName[lang]} title={messages[lang].floor.title} />
  );
}

export default defineGuestInfoComponent("floor", Floor);
