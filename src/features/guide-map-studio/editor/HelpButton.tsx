"use client";

// 上の帯の「使い方」ボタン（使い方の中身は、開いたときに読み込む）

import { HelpCircle } from "lucide-react";
import { useI18n } from "./i18n";

// compact＝スタジオの上の帯用（小さめ。狭い画面では「？」だけ）
export function StudioHelpButton({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("使い方")}
      title={t("使い方")}
      className={
        compact
          ? "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap hover:bg-accent"
          : "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
      }
    >
      <HelpCircle className="size-4" />
      <span className={compact ? "hidden min-[1360px]:inline" : undefined}>
        {t("使い方")}
      </span>
    </button>
  );
}
