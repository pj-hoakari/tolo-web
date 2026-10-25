"use client";

import { useLocale, useTranslations } from "next-intl";
import { resolveLabel } from "@/features/tenant/management/graph/utils/labels";
import { FloorView } from "./FloorView";
import { setGuideMapActiveFloor, useGuideMapFloor } from "./guideMapFloorStore";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function Floor(_props: GuestInfoComponentProps) {
  // 案内マップが表示しているフロアをそのまま「現在のフロア」として出す（切り替えも共有）。
  // 案内マップが無い・読み込み前は placeholderName を表示する。
  const t = useTranslations("Guest.floor");
  const locale = useLocale();
  const { floors: options, activeFloorId } = useGuideMapFloor();
  const floors = options.map((f) => ({
    id: f.id,
    name: resolveLabel(f.labels, locale).text,
  }));
  const active = floors.find((f) => f.id === activeFloorId);

  return (
    <FloorView
      title={t("title")}
      floorName={active?.name ?? t("placeholderName")}
      floors={floors}
      activeFloorId={activeFloorId}
      onSelectFloor={setGuideMapActiveFloor}
      selectLabel={t("selectLabel")}
    />
  );
}

export default defineGuestInfoComponent("floor", Floor);
