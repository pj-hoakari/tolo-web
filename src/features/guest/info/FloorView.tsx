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
      <p className="text-4xl font-bold tabular-nums text-guest-ink">
        {floorName}
      </p>
    </InfoCard>
  );
}
