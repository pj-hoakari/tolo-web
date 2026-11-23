"use client";

// チェック（書き出す前にも出す）：行けない場所などの気になる所を、重さ（3 段階・色分け）の順に並べる。
// 「その場所を表示」で直す場所へ移り、地図の上でその場所を光らせる。
// 意図してそうしている項目は「OK」で消せる（消した項目は下にまとめ、「戻す」で元に戻せる）

import {
  ArrowRight,
  Check,
  Download,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
} from "@/components/ui/disclosure";
import { useI18n } from "../../i18n/i18n";
import type { CheckMessage } from "../../utils/checkMessages";
import {
  CHECK_LEVEL_COLOR,
  CHECK_LEVELS,
  type CheckIssue,
  type CheckLevel,
  checkIssueKey,
} from "../../utils/guideMapCheck";
import { Modal } from "./Modal";

type CheckDialogProps = {
  check: { issues: CheckIssue[] | null; forExport: boolean };
  pageLabel: string;
  /** 「OK」で消した項目の鍵 */
  ignored: ReadonlySet<string>;
  messageOf: (is: CheckIssue) => CheckMessage;
  onOpenIssue: (is: CheckIssue) => void;
  onIgnore: (is: CheckIssue) => void;
  onRestore: (is: CheckIssue) => void;
  onExportAnyway: () => void;
  onClose: () => void;
};

export function CheckDialog({
  check,
  pageLabel,
  ignored,
  messageOf,
  onOpenIssue,
  onIgnore,
  onRestore,
  onExportAnyway,
  onClose,
}: CheckDialogProps) {
  const { t } = useI18n();
  const levelName: Record<CheckLevel, string> = {
    error: t("直してください"),
    warn: t("確認してください"),
    info: t("念のため"),
  };
  const all = check.issues ?? [];
  const shown = all.filter((is) => !ignored.has(checkIssueKey(is)));
  const hidden = all.filter((is) => ignored.has(checkIssueKey(is)));
  const countOf = (lv: CheckLevel) =>
    shown.filter((is) => is.level === lv).length;
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
      ) : (
        <>
          {shown.length === 0 ? (
            <p className="mt-4 text-sm">{t("問題は見つかりませんでした。")}</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "気になる所が{n}件あります。「その場所を表示」で、地図の上の場所が光ります。意図してそうしている所は「OK」で消せます。",
                  { n: shown.length },
                )}
              </p>
              {/* 重さごとの件数（色の見本を兼ねる） */}
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                {CHECK_LEVELS.map((lv) => (
                  <li key={lv} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ background: CHECK_LEVEL_COLOR[lv] }}
                    />
                    {levelName[lv]}
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {countOf(lv)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="studio-thin-scroll mt-3 flex min-h-0 flex-col gap-3 overflow-auto">
            {shown.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {shown.map((is) => (
                  <li key={checkIssueKey(is)}>
                    <IssueCard
                      issue={is}
                      levelName={levelName[is.level]}
                      message={messageOf(is)}
                      onOpen={() => onOpenIssue(is)}
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => onIgnore(is)}
                          aria-label={t("「{title}」を OK にして消す", {
                            title: messageOf(is).title,
                          })}
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <Check className="size-3.5" />
                          {t("OK")}
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            {/* OK で消した項目。開くと見られて、「戻す」で一覧に戻せる */}
            {hidden.length > 0 && (
              <Disclosure className="min-w-0 rounded-md border px-2">
                <DisclosureHeader className="py-2 text-xs text-muted-foreground">
                  {t("OK にした項目（{n}件）", { n: hidden.length })}
                </DisclosureHeader>
                <DisclosurePanel className="text-xs">
                  <ul className="flex flex-col gap-1.5 pb-1">
                    {hidden.map((is) => (
                      <li key={checkIssueKey(is)}>
                        <IssueCard
                          issue={is}
                          levelName={levelName[is.level]}
                          message={messageOf(is)}
                          muted
                          onOpen={() => onOpenIssue(is)}
                          action={
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() => onRestore(is)}
                              aria-label={t("「{title}」を一覧に戻す", {
                                title: messageOf(is).title,
                              })}
                              className="h-7 gap-1 px-2 text-xs"
                            >
                              <RotateCcw className="size-3.5" />
                              {t("戻す")}
                            </Button>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </DisclosurePanel>
              </Disclosure>
            )}
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          // 開いたときにフォーカスを中へ移し、Esc で閉じられるようにする
          autoFocus
          onPress={onClose}
          className="h-8 px-3 text-xs"
        >
          {check.forExport ? t("キャンセル") : t("閉じる")}
        </Button>
        {check.forExport && check.issues && check.issues.length > 0 && (
          <Button
            size="sm"
            onPress={onExportAnyway}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Download className="size-3.5" />
            {t("このまま書き出す")}
          </Button>
        )}
      </div>
    </Modal>
  );
}

// チェックの 1 項目：左に重さの色の帯、題名・重さ・直し方、下に「その場所を表示」と、右に OK（戻す）
function IssueCard({
  issue,
  levelName,
  message,
  muted = false,
  onOpen,
  action,
}: {
  issue: CheckIssue;
  levelName: string;
  message: CheckMessage;
  muted?: boolean;
  onOpen: () => void;
  action: React.ReactNode;
}) {
  const color = CHECK_LEVEL_COLOR[issue.level];
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border border-l-4 px-3 py-2.5 text-xs leading-relaxed"
      style={{ borderLeftColor: muted ? "var(--studio-divider)" : color }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span
            className={
              muted
                ? "min-w-0 flex-1 text-[13px] text-muted-foreground"
                : "min-w-0 flex-1 text-[13px] font-medium"
            }
          >
            {message.title}
          </span>
          <span
            className="shrink-0 rounded px-1.5 py-px text-[10px] font-medium"
            style={
              muted
                ? { border: "1px solid var(--studio-divider)" }
                : {
                    background: `color-mix(in srgb, ${color} 16%, transparent)`,
                    color: `color-mix(in srgb, ${color} 70%, var(--studio-text-primary))`,
                  }
            }
          >
            {levelName}
          </span>
        </div>
        {!muted && (
          <span className="mt-0.5 block text-muted-foreground">
            {message.hint}
          </span>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Button
            variant="link"
            onPress={onOpen}
            className="h-auto gap-1 p-0 text-xs"
          >
            {message.go}
            <ArrowRight className="size-3" />
          </Button>
          {action}
        </div>
      </div>
    </div>
  );
}
