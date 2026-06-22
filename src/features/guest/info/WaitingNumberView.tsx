import { InfoCard } from "./InfoCard";

export type WaitingNumberViewProps = {
  waitingNumber: number;
  label?: string;
  unit?: string;
};

export function WaitingNumberView({
  waitingNumber,
  label = "現在の待ち人数",
  unit = "人",
}: WaitingNumberViewProps) {
  return (
    <InfoCard title={label}>
      <p className="flex items-baseline gap-1 text-guest-ink">
        <span className="text-4xl font-bold tabular-nums">{waitingNumber}</span>
        <span className="text-base text-guest-ink-muted">{unit}</span>
      </p>
    </InfoCard>
  );
}
