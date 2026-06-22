"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { messages } from "../i18n/messages";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";
import { WaitingNumberView } from "./WaitingNumberView";

function WaitingNumber(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId を使って API から待ち人数を取得する
  const waitingNumber = 5;

  const { lang } = useLanguage();
  const m = messages[lang].waitingNumber;

  return (
    <WaitingNumberView
      waitingNumber={waitingNumber}
      label={m.title}
      unit={m.unit}
    />
  );
}

export default defineGuestInfoComponent("waiting-number", WaitingNumber);
