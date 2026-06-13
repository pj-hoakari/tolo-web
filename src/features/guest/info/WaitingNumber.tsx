import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";
import { WaitingNumberView } from "./WaitingNumberView";

function WaitingNumber(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId を使って API から待ち人数を取得する
  const waitingNumber = 0;

  return <WaitingNumberView waitingNumber={waitingNumber} />;
}

export default defineGuestInfoComponent("waiting-number", WaitingNumber);
