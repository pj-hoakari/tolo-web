import { EstimatedWaitTimeView } from "./EstimatedWaitTimeView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function EstimatedWaitTime(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId を使って API から推定待ち時間を取得する
  const minutes = 15;

  return <EstimatedWaitTimeView minutes={minutes} />;
}

export default defineGuestInfoComponent(
  "estimated-wait-time",
  EstimatedWaitTime,
);
