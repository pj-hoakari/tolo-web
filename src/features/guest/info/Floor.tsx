"use client";

import { useTranslations } from "next-intl";
import { FloorView } from "./FloorView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function Floor(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId で現在のフロア番号・表示名を取得する。
  //       案内マップと連動して表示フロアを切り替える。
  //       それまでは placeholderName をフロア名として表示する。
  const t = useTranslations("Guest.floor");

  return <FloorView floorName={t("placeholderName")} title={t("title")} />;
}

export default defineGuestInfoComponent("floor", Floor, { span: 1 });
