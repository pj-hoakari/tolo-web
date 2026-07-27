import { cn } from "@/lib/utils";

/** プロパティパネルで編集対象になっている要素の種別 */
export type SelectionKind = "node" | "edge";

const KIND_LABEL: Record<SelectionKind, string> = {
  node: "ポイント",
  edge: "ルート",
};

const KIND_BADGE: Record<SelectionKind, string> = {
  node: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  edge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export type SelectionHeaderProps = {
  kind: SelectionKind;
  id: string;
};

/** 選択中の要素の種別バッジと ID を並べるヘッダ */
export function SelectionHeader({ kind, id }: SelectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 font-semibold text-[10px]",
          KIND_BADGE[kind],
        )}
      >
        {KIND_LABEL[kind]}
      </span>
      <code className="text-[10px] text-muted-foreground">{id}</code>
    </div>
  );
}
