"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { messages } from "../i18n/messages";
import { CallingNumberView } from "./CallingNumberView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function CallingNumber(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId を使って API から呼び出し番号を取得する
  const callingNumber = 12;

  const { lang } = useLanguage();
  const m = messages[lang].callingNumber;

  return (
    <CallingNumberView
      callingNumber={callingNumber}
      label={m.title}
      unit={m.unit}
    />
  );
}

export default defineGuestInfoComponent("calling-number", CallingNumber);
