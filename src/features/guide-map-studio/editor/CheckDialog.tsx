"use client";

// チェック（書き出す前にも出す）：行けない場所などの気になる所を並べ、押すと直す場所へ移る

import { ArrowRight, Download, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n";
import { Modal } from "./Modal";
import { GUIDE } from "./shared";
import type { CheckIssue } from "./venueMapCheck";

type CheckDialogProps = {
  check: { issues: CheckIssue[] | null; forExport: boolean };
  pageLabel: string;
  messageOf: (is: CheckIssue) => { title: string; hint: string; go: string };
  onOpenIssue: (is: CheckIssue) => void;
  onExportAnyway: () => void;
  onClose: () => void;
};

export function CheckDialog({
  check,
  pageLabel,
  messageOf,
  onOpenIssue,
  onExportAnyway,
  onClose,
}: CheckDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      labelledBy="check-title"
      className="flex max-h-[80vh] w-full max-w-lg flex-col"
      onClose={onClose}
    >
      <h2 id="check-title" className="flex items-center gap-2 text-base">
        <ListChecks className="size-4" />
        {check.forExport ? t("書き出す前のチェック") : t("チェック")}
        {pageLabel && (
          <span className="text-xs text-muted-foreground">{pageLabel}</span>
        )}
      </h2>
      {check.issues === null ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("確認しています…")}
        </p>
      ) : check.issues.length === 0 ? (
        <p className="mt-4 text-sm">{t("問題は見つかりませんでした。")}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "気になる所が{n}件あります。項目を押すと、直す場所へ移ります。",
              { n: check.issues.length },
            )}
          </p>
          <ul className="studio-thin-scroll mt-3 flex min-h-0 flex-col gap-1 overflow-auto">
            {check.issues.map((is, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: チェックの結果は開くたびに作り直す一覧で、並びは変わらない
              <li key={i}>
                {(() => {
                  const m = messageOf(is);
                  return (
                    <button
                      type="button"
                      onClick={() => onOpenIssue(is)}
                      className="group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs leading-relaxed hover:border-primary hover:bg-accent/60"
                    >
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-sm"
                        style={{
                          background:
                            is.level === "warn"
                              ? GUIDE
                              : "var(--studio-divider)",
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 text-[13px] font-medium">
                            {m.title}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-px text-[10px]",
                              is.level === "warn"
                                ? "bg-primary text-primary-foreground"
                                : "border text-muted-foreground",
                            )}
                          >
                            {is.level === "warn"
                              ? t("直してください")
                              : t("念のため")}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {m.hint}
                        </span>
                        <span className="mt-1 inline-flex items-center gap-1 font-medium text-primary group-hover:underline">
                          {m.go}
                          <ArrowRight className="size-3" />
                        </span>
                      </span>
                    </button>
                  );
                })()}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          // biome-ignore lint/a11y/noAutofocus: 開いたときにフォーカスを中へ移し、Esc で閉じられるようにする（React Aria の Dialog に置き換えるまで）
          autoFocus
          onClick={onClose}
          className="h-8 rounded-md border px-3 text-xs hover:bg-accent"
        >
          {check.forExport ? t("キャンセル") : t("閉じる")}
        </button>
        {check.forExport && check.issues && check.issues.length > 0 && (
          <button
            type="button"
            onClick={onExportAnyway}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
          >
            <Download className="size-3.5" />
            {t("このまま書き出す")}
          </button>
        )}
      </div>
    </Modal>
  );
}
