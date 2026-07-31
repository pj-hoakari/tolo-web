import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

export type GraphViewerToolbarProps = {
  /** 編集ページへの遷移。未指定なら編集への導線を出さない */
  onEditGraph?: () => void;
  onSave: () => void;
};

/** 表示専用ビューのツールバー（編集ページへの導線・紐づけの保存） */
export function GraphViewerToolbar({
  onEditGraph,
  onSave,
}: GraphViewerToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-border border-b bg-card px-4 py-2">
      <p className="shrink-0 font-semibold text-foreground text-sm">
        会場グラフ
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onEditGraph ? (
          <Button
            variant="outline"
            size="sm"
            onPress={onEditGraph}
            className="gap-1.5"
          >
            <Pencil aria-hidden className="size-3.5" />
            グラフを編集
          </Button>
        ) : null}
        <div className="ml-1 border-border border-l pl-2">
          <Button size="sm" onPress={onSave}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
