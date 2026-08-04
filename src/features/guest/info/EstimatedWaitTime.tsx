"use client";

import { useTranslations } from "next-intl";
import { EstimatedWaitTimeView } from "./EstimatedWaitTimeView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function EstimatedWaitTime(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId を使って API から推定待ち時間を取得する
  const minutes = 15;

  const t = useTranslations("Guest.estimatedWaitTime");

  return (
    <EstimatedWaitTimeView
      minutes={minutes}
      label={t("title")}
      prefix={t("prefix")}
      unit={t("unit")}
    />
  );
}

export default defineGuestInfoComponent(
  "estimated-wait-time",
  EstimatedWaitTime,
  { span: 1 },
);
