import { InfoCard } from "./InfoCard";

export type FloorViewProps = {
  /** フロアの表示名（表示言語で解決済み、例: 1F） */
  floorName: string;
  title?: string;
};

export function FloorView({
  floorName,
  title = "現在のフロア",
}: FloorViewProps) {
  return (
    <InfoCard title={title}>
      <p className="font-bold text-4xl text-guest-ink tabular-nums">
        {floorName}
      </p>
    </InfoCard>
  );
}
