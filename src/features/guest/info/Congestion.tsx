"use client";

import type { Messages } from "next-intl";
import { useTranslations } from "next-intl";
import {
  type CongestionArea,
  type CongestionLevel,
  CongestionView,
} from "./CongestionView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

/** 名称を解決できるエリア id */
type AreaId = keyof Messages["Guest"]["congestion"]["areas"];

/** 混雑レベルだけを持つ生のエリア（本来は API レスポンス。名称は Guest.congestion.areas から解決する） */
type RawArea = {
  id: AreaId;
  level: CongestionLevel;
};

// --- ダミーの混雑状況（本来は API から取得する） ---
const rawAreas: RawArea[] = [
  { id: "entrance", level: "high" },
  { id: "hall", level: "mid" },
  { id: "cafe", level: "low" },
  { id: "goods", level: "high" },
];

function Congestion(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId で混雑状況 API を取得する。
  //       エリア ID・混雑レベル・最終更新日時。
  //       エリアをタップして詳細（人数など）を表示する対応は将来追加。
  const t = useTranslations("Guest.congestion");

  const areas: CongestionArea[] = rawAreas.map((area) => ({
    id: area.id,
    name: t(`areas.${area.id}`),
    level: area.level,
  }));

  return (
    <CongestionView
      areas={areas}
      title={t("title")}
      levelLabels={{
        low: t("levels.low"),
        mid: t("levels.mid"),
        high: t("levels.high"),
      }}
    />
  );
}

export default defineGuestInfoComponent("congestion", Congestion);
