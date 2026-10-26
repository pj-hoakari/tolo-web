import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";

export type FloorOption = { id: string; name: string };

export type FloorViewProps = {
  /** フロアの表示名（表示言語で解決済み、例: 1F） */
  floorName: string;
  title?: string;
  /** 切り替えられるフロア。2 つ以上あるときだけ切り替えボタンを出す */
  floors?: readonly FloorOption[];
  activeFloorId?: string | null;
  onSelectFloor?: (floorId: string) => void;
  /** フロア切り替えボタン群の aria-label */
  selectLabel?: string;
};

/**
 * 現在のフロアを示す横長の帯。
 * 値が短い（例: 1F）ため、カード 1 枚分の四角にせず、見出しと値を 1 行に並べる。
 * 案内マップと連動していて、フロアが複数あればここで表示フロアを切り替えられる。
 */
export function FloorView({
  floorName,
  title = "現在のフロア",
  floors = [],
  activeFloorId = null,
  onSelectFloor,
  selectLabel = "表示するフロア",
}: FloorViewProps) {
  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl border border-primary/12 bg-secondary px-5 py-3 shadow-sm">
      <h2 className="shrink-0 text-sm font-medium tracking-wide text-primary/55">
        {title}
      </h2>
      {floors.length > 1 ? (
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={activeFloorId ? [activeFloorId] : []}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next != null) onSelectFloor?.(String(next));
          }}
          aria-label={selectLabel}
          className="flex-wrap justify-end gap-1.5"
        >
          {floors.map((floor) => (
            <Toggle
              key={floor.id}
              id={floor.id}
              size="sm"
              className="selected:border-accent selected:bg-accent selected:text-secondary h-10 min-w-11 rounded-full border border-primary/12 bg-secondary px-3 text-base font-bold text-primary/55 tabular-nums hover:bg-secondary hover:text-accent"
            >
              {floor.name}
            </Toggle>
          ))}
        </ToggleButtonGroup>
      ) : (
        <p className="text-2xl font-bold text-primary tabular-nums">
          {floorName}
        </p>
      )}
    </section>
  );
}
