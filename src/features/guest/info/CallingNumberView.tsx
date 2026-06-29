import { InfoCard } from "./InfoCard";

export type CallingNumberViewProps = {
  callingNumber: number;
  label?: string;
  unit?: string;
};

export function CallingNumberView({
  callingNumber,
  label = "現在の呼び出し番号",
  unit = "番",
}: CallingNumberViewProps) {
  return (
    <InfoCard title={label}>
      <p className="flex items-baseline gap-1">
        <span className="text-5xl font-bold tabular-nums text-guest-accent">
          {callingNumber}
        </span>
        <span className="text-base text-guest-primary/55">{unit}</span>
      </p>
    </InfoCard>
  );
}
