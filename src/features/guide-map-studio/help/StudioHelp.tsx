"use client";

import { ChevronRight, Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n/i18n";
import { SECTIONS_EN } from "./sectionsEn";
import { SECTIONS_JA } from "./sectionsJa";

// 案内マップ・スタジオの使い方（Q&A）。地図を作る人向けに、専門用語を使わず、画面に出ている言葉で説明する。
// 知りたいことを検索・カテゴリから探せる。「困ったとき」には、使っていてつまずきやすい点をまとめている。

// React ノードから検索用の文字を取り出す
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return textOf(node.props.children);
  return "";
}

export function StudioHelpDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const sections = (lang === "ja" ? SECTIONS_JA : SECTIONS_EN)
    .map((s) => ({
      ...s,
      items: q
        ? s.items.filter((it) =>
            `${it.q} ${textOf(it.a)} ${it.keywords ?? ""}`
              .toLowerCase()
              .includes(q),
          )
        : s.items,
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div
      data-keep-selection
      className="studio-fade fixed inset-0 z-[70] flex items-start justify-center bg-black/20 p-6 pt-[10vh]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("使い方")}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border bg-card"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="flex items-center gap-3 border-b px-8 py-6">
          <h2 className="flex-1 text-2xl font-normal tracking-[0.06em]">
            {t("使い方")}
          </h2>
          <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">
            Q&amp;A
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("閉じる")}
            className="ml-2 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="border-b px-8 py-4">
          <label className="flex items-center gap-2 rounded-md border border-input px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              // biome-ignore lint/a11y/noAutofocus: 開いた・名前の編集を始めたときに、すぐ入力できるようにする
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "知りたいことを入力（例：コピー、階段、そろえる）",
              )}
              className="h-9 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {sections.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(
                "「{q}」に当てはまる質問がありません。別のことばで探してみてください。",
                { q: query },
              )}
            </p>
          ) : (
            sections.map((s) => (
              <section key={s.title} className="mb-8 last:mb-0">
                <h3 className="mb-2 font-mono text-[11px] font-normal tracking-[0.16em] text-muted-foreground">
                  {s.title}
                </h3>
                <div className="divide-y border-y">
                  {s.items.map((it) => (
                    <details key={it.q} open={Boolean(q)} className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-1 py-3.5 text-sm hover:bg-accent/60">
                        <span className="font-mono text-xs text-primary">
                          Q
                        </span>
                        <span className="flex-1">{it.q}</span>
                        <ChevronRight
                          className={cn(
                            "size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-90",
                          )}
                        />
                      </summary>
                      <div className="studio-fade flex gap-3 px-1 pb-5 text-sm leading-loose text-muted-foreground">
                        <span className="font-mono text-xs leading-loose text-foreground">
                          A
                        </span>
                        <div className="flex-1">{it.a}</div>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
