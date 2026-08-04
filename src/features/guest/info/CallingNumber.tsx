"use client";

import { useTranslations } from "next-intl";
import { CallingNumberView } from "./CallingNumberView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function CallingNumber(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId を使って API から呼び出し番号を取得する
  const callingNumber = 12;

  const t = useTranslations("Guest.callingNumber");

  return (
    <CallingNumberView
      callingNumber={callingNumber}
      label={t("title")}
      unit={t("unit")}
    />
  );
}

export default defineGuestInfoComponent("calling-number", CallingNumber, {
  span: 1,
});
