"use client";

// 書き出すマップを選ぶ（タブが2つ以上のときだけ出す）

import { Download } from "lucide-react";
import { useI18n } from "./i18n";
import { Modal } from "./Modal";
import type { StudioPage } from "./venueMap";

type ExportPickerDialogProps = {
  pages: StudioPage[];
  activePageId: string;
  pageName: (p: StudioPage, i: number) => string;
  onPick: (id: string) => void;
  onClose: () => void;
};

export function ExportPickerDialog({
  pages,
  activePageId,
  pageName,
  onPick,
  onClose,
}: ExportPickerDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      labelledBy="export-picker-title"
      className="w-full max-w-sm"
      onClose={onClose}
    >
      <h2 id="export-picker-title" className="text-base">
        {t("どのマップを書き出しますか？")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("選んだタブのマップを1つのファイルとして保存します。")}
      </p>
      <ul className="mt-4 flex flex-col gap-1.5">
        {pages.map((p, i) => {
          const d = p.doc;
          return (
            <li key={p.id}>
              <button
                type="button"
                // biome-ignore lint/a11y/noAutofocus: 開いたときにフォーカスを中へ移し、Esc で閉じられるようにする（React Aria の Dialog に置き換えるまで）
                autoFocus={p.id === activePageId}
                onClick={() => onPick(p.id)}
                className="flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left hover:bg-accent"
              >
                <Download className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {pageName(p, i)}
                  </span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {t("{f}フロア・{n}件", {
                      f: d.floors.length,
                      n: d.objects.length,
                    })}
                  </span>
                </span>
                {p.id === activePageId && (
                  <span className="shrink-0 text-[11px] text-primary">
                    {t("表示中")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-md border px-3 text-xs hover:bg-accent"
        >
          {t("キャンセル")}
        </button>
      </div>
    </Modal>
  );
}
