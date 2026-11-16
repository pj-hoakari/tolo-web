"use client";

import { ChevronDown, ListChecks } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "../../i18n/i18n";

export type ShareMenuItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  run: () => void;
  disabled?: boolean;
  /** この項目の前に区切りを入れる（文字があれば見出しも出す） */
  group?: string;
};

// 「確かめる・共有」のメニュー（つなぎ・一覧・チェック・見比べる・画像・印刷）
export function ShareMenu({ items }: { items: ShareMenuItem[] }) {
  const { t } = useI18n();
  const [shareMenu, setShareMenu] = React.useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShareMenu((v) => !v)}
        aria-expanded={shareMenu}
        aria-haspopup="menu"
        aria-label={t("確かめる・共有")}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap hover:bg-accent",
          shareMenu && "bg-accent",
        )}
      >
        <ListChecks className="size-4" />
        <span className="hidden min-[1200px]:inline">
          {t("確かめる・共有")}
        </span>
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      {shareMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onPointerDown={() => setShareMenu(false)}
          />
          <div
            role="menu"
            className="studio-fade absolute top-full right-0 z-50 mt-1.5 w-72 rounded-lg border bg-card p-1.5 text-xs shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]"
          >
            {items.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: メニューの項目は決まった並びで、並べ替えない
              <React.Fragment key={i}>
                {m.group !== undefined && (
                  <div className="my-1 border-t">
                    {m.group && (
                      <span className="block px-2.5 pt-2 pb-0.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                        {m.group}
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={m.disabled}
                  onClick={() => {
                    setShareMenu(false);
                    m.run();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-accent disabled:opacity-40"
                >
                  <m.icon className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium">{m.label}</span>
                    <span className="block text-muted-foreground">{m.sub}</span>
                  </span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
