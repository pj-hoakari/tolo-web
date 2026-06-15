"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { type Lang, messages } from "../i18n/messages";
import {
  type CongestionArea,
  type CongestionLevel,
  CongestionView,
} from "./CongestionView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

/** 言語ごとの名前を持つ生のエリア（本来は API レスポンス） */
type RawArea = {
  id: string;
  level: CongestionLevel;
  name: Record<Lang, string>;
};

// --- ダミーの混雑状況（本来は API から取得する） ---
const rawAreas: RawArea[] = [
  {
    id: "entrance",
    level: "high",
    name: { ja: "入場ゲート", en: "Entrance gate", zh: "入场口" },
  },
  { id: "hall", level: "mid", name: { ja: "ホール", en: "Hall", zh: "大厅" } },
  {
    id: "cafe",
    level: "low",
    name: { ja: "カフェ", en: "Café", zh: "咖啡厅" },
  },
  {
    id: "goods",
    level: "high",
    name: { ja: "グッズ売り場", en: "Merch", zh: "商品区" },
  },
];

function Congestion(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId で混雑状況 API を取得する。
  //       エリア ID・混雑レベル・最終更新日時。
  //       エリアをタップして詳細（人数など）を表示する対応は将来追加。
  const { lang } = useLanguage();
  const c = messages[lang].congestion;

  const areas: CongestionArea[] = rawAreas.map((area) => ({
    id: area.id,
    name: area.name[lang],
    level: area.level,
  }));

  return (
    <CongestionView areas={areas} title={c.title} levelLabels={c.levels} />
  );
}

export default defineGuestInfoComponent("congestion", Congestion);
