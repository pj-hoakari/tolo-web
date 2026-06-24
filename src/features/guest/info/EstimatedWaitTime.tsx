"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { messages } from "../i18n/messages";
import { EstimatedWaitTimeView } from "./EstimatedWaitTimeView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function EstimatedWaitTime(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId を使って API から推定待ち時間を取得する
  const minutes = 15;

  const { lang } = useLanguage();
  const m = messages[lang].estimatedWaitTime;

  return (
    <EstimatedWaitTimeView
      minutes={minutes}
      label={m.title}
      prefix={m.prefix}
      unit={m.unit}
    />
  );
}

export default defineGuestInfoComponent(
  "estimated-wait-time",
  EstimatedWaitTime,
  { span: 1 },
);
