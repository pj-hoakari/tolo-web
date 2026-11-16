"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "../../i18n/i18n";
import type { PaletteKey } from "../../type";
import { PALETTE, PALETTE_GROUPS } from "../../utils/guideMapDoc";
import type { Tool } from "../../utils/shared";
import { nowMs } from "../../utils/snapshots";
import { ColorSwatch } from "../parts/ColorSwatch";
import { ToolCard } from "../parts/ToolCard";
import { TOOLS } from "./tools";

// 左の道具の列（細め：アイコン＋小さな名前）と、いまの色。使い方とキーはマウスを置くと出る
export function ToolRail({
  tool,
  onTool,
  color,
  onColor,
  hasSelection,
  disabled,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  color: PaletteKey;
  /** 色を選んだ（選んでいる物があれば、その色も変える） */
  onColor: (color: PaletteKey) => void;
  hasSelection: boolean;
  /** プレビュー中は使えない */
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [colorMenu, setColorMenu] = React.useState(false); // 道具の列の色えらび
  // 道具の説明のカード（動画つき）。1枚だけ出して、マウスを置いた道具の横へ動かす。
  // ・開く：少し置いてから。閉じた直後に隣の道具へ移ったときは待たずに開く
  // ・移る：開いたまま隣の道具へ移ったら、出し直さずにすべって移る（中身だけ入れ替える）
  // ・閉じる：すき間を通っただけでちらつかないよう少し待ち、短くフェードして消す
  const [toolCard, setToolCard] = React.useState<{
    tool: Tool;
    top: number;
    left: number;
    notch: number;
    phase: "in" | "swap" | "out";
  } | null>(null);
  const toolCardRef = React.useRef<HTMLDivElement>(null);
  const toolCardOpenTimer = React.useRef<number | undefined>(undefined);
  const toolCardCloseTimer = React.useRef<number | undefined>(undefined);
  const toolCardWarmUntil = React.useRef(0);
  const openToolCard = (key: Tool, el: HTMLElement, now = false) => {
    window.clearTimeout(toolCardOpenTimer.current);
    window.clearTimeout(toolCardCloseTimer.current);
    // 道具の上端にそろえる。下にはみ出すときは上へずらす（三角はいつも道具の真ん中を指す）
    const r = el.getBoundingClientRect();
    const h = toolCardRef.current?.offsetHeight ?? 300;
    const top = Math.max(8, Math.min(r.top - 6, window.innerHeight - h - 12));
    const place = {
      tool: key,
      top,
      left: r.right + 12,
      notch: r.top + r.height / 2 - top - 5,
    };
    if (toolCard) setToolCard({ ...place, phase: "swap" });
    else if (now || nowMs() < toolCardWarmUntil.current)
      setToolCard({ ...place, phase: "in" });
    else
      toolCardOpenTimer.current = window.setTimeout(
        () => setToolCard({ ...place, phase: "in" }),
        380,
      );
  };
  const closeToolCard = (wait = 90) => {
    window.clearTimeout(toolCardOpenTimer.current);
    window.clearTimeout(toolCardCloseTimer.current);
    if (!toolCard) return;
    toolCardCloseTimer.current = window.setTimeout(() => {
      toolCardWarmUntil.current = nowMs() + 700;
      setToolCard((c) => (c ? { ...c, phase: "out" } : c));
      toolCardCloseTimer.current = window.setTimeout(
        () => setToolCard(null),
        130,
      );
    }, wait);
  };
  return (
    <nav
      aria-label={t("道具")}
      className={cn(
        "z-40 flex w-[68px] shrink-0 flex-col items-stretch gap-0.5 self-start rounded-xl border bg-card p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-18px_rgba(0,0,0,0.25)]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {TOOLS.map(({ key, label, short, shortcut, desc, Icon }) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: マウスを置いた・フォーカスした道具の説明カードを出すだけ（操作は中のボタン）
        <div
          key={key}
          className="relative"
          onPointerEnter={(e) => openToolCard(key, e.currentTarget)}
          onPointerLeave={() => closeToolCard()}
          onFocus={(e) => openToolCard(key, e.currentTarget, true)}
          onBlur={() => closeToolCard()}
        >
          <button
            type="button"
            onClick={() => {
              onTool(key);
              closeToolCard(0);
            }}
            aria-pressed={tool === key}
            aria-label={t(label)}
            aria-keyshortcuts={shortcut}
            aria-describedby={`tool-desc-${key}`}
            className={cn(
              "flex w-full flex-col items-center gap-1 rounded-lg px-0.5 py-2 text-[10px] leading-none font-medium whitespace-nowrap",
              tool === key
                ? "bg-primary text-primary-foreground"
                : "text-foreground/80 hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-[18px]" />
            <span className="text-center">{t(short ?? label)}</span>
          </button>
          <span id={`tool-desc-${key}`} className="sr-only">
            {t(desc)}
          </span>
        </div>
      ))}
      {/* 使い方のカード（マウスを置く・キーボードで移ると出る）。上に、その道具を使っている短い動画が流れる */}
      {toolCard &&
        (() => {
          const def = TOOLS.find((x) => x.key === toolCard.tool);
          if (!def) return null;
          return (
            <ToolCard
              ref={toolCardRef}
              {...toolCard}
              label={t(def.label)}
              desc={t(def.desc)}
              shortcut={def.shortcut}
              Icon={def.Icon}
            />
          );
        })()}
      <span className="mx-1.5 my-1 h-px bg-border" />
      {/* 色：いまの色の1つのボタン。押すと色を選べる */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setColorMenu((v) => !v)}
          aria-expanded={colorMenu}
          aria-haspopup="menu"
          title={t("色")}
          className="flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium hover:bg-accent"
        >
          <span
            className="size-[18px] rounded-md border"
            style={{ background: PALETTE[color].fill }}
          />
          {t("色")}
        </button>
        {colorMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onPointerDown={() => setColorMenu(false)}
            />
            <div
              role="menu"
              className="studio-fade absolute bottom-0 left-full z-50 ml-2 max-h-[80vh] w-max overflow-y-auto rounded-lg border bg-card p-2 text-xs shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]"
            >
              {hasSelection && (
                <p className="mb-1.5 leading-relaxed text-muted-foreground">
                  {t("選んでいる物の色も変わります")}
                </p>
              )}
              {PALETTE_GROUPS.map((group) => (
                <div key={group.label} className="mb-2 last:mb-0">
                  <p className="mb-1 font-medium text-muted-foreground">
                    {t(group.label)}
                  </p>
                  {/* 見出しごとに 1 行に並べる（折り返さない） */}
                  <div className="flex flex-nowrap gap-1.5">
                    {group.keys.map((k) => (
                      <ColorSwatch
                        key={k}
                        k={k}
                        role="menuitemradio"
                        aria-checked={color === k}
                        selected={color === k}
                        onClick={() => {
                          onColor(k);
                          setColorMenu(false);
                        }}
                        className="size-8 shrink-0"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
