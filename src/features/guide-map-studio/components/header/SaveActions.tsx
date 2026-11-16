"use client";

import { Check, Download, Redo2, Undo2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "../../i18n/i18n";

// 上の帯の右側：元に戻す／やり直し・tolo-web に保存・ファイルに書き出す
export function SaveActions({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  serverSave,
  unsavedToServer,
  onServerSave,
  exportDone,
  onExport,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** tolo-web への保存（保存中・保存した直後の「保存しました」） */
  serverSave: "idle" | "saving" | "done";
  /** tolo-web に保存していない変更があるか（ボタンに印を付ける） */
  unsavedToServer: boolean;
  onServerSave: () => void;
  /** 書き出した直後の「完了」表示 */
  exportDone: boolean;
  onExport: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title={t("元に戻す（⌘Z）")}
          aria-label={t("元に戻す")}
          className="flex size-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-35"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title={t("やり直し（⌘⇧Z）")}
          aria-label={t("やり直し")}
          className="flex size-8 items-center justify-center rounded-md hover:bg-accent disabled:opacity-35"
        >
          <Redo2 className="size-4" />
        </button>
      </div>
      <Button
        variant="outline"
        onPress={onServerSave}
        isDisabled={serverSave === "saving"}
        className="h-8 min-w-[6.5rem] shrink-0 gap-1.5 px-3.5 tracking-[0.04em]"
      >
        {serverSave === "done" ? (
          <Check className="size-4" />
        ) : (
          <UploadCloud className="size-4" />
        )}
        {serverSave === "saving"
          ? t("保存中…")
          : serverSave === "done"
            ? t("保存しました")
            : t("保存")}
        {serverSave === "idle" && unsavedToServer && (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            <span className="sr-only">
              {t("（tolo-web に保存していない変更があります）")}
            </span>
          </>
        )}
      </Button>
      <button
        type="button"
        onClick={onExport}
        className="inline-flex h-8 min-w-[6.5rem] shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium tracking-[0.04em] text-primary-foreground"
      >
        {exportDone ? (
          <>
            {/* 細い線のチェックマークを描く（stroke-dashoffset） */}
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path className="studio-check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {t("完了")}
          </>
        ) : (
          <>
            <Download className="size-4" />
            {t("書き出す")}
          </>
        )}
      </button>
    </>
  );
}
