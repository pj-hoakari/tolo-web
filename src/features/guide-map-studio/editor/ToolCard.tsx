"use client";

// 道具にマウスを置いたときに出る説明のカード（動き（GIF）つき）

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tool } from "./shared";
import { TOOL_GIFS } from "./toolGifs";

// 動きを減らす設定のときは、動き（GIF）を出さない（GIF は止められないため、名前と説明だけにする）
function useReducedMotion() {
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

// 道具の説明のカード。動き（GIF）は assets/ に置き、toolGifs.ts から読む
// phase：in＝開いたところ／swap＝隣の道具へ移ったところ（中身だけ入れ替える）／out＝閉じるところ
type ToolCardProps = {
  ref: React.Ref<HTMLDivElement>;
  tool: Tool;
  top: number;
  left: number;
  notch: number;
  phase: "in" | "swap" | "out";
  label: string;
  desc: string;
  shortcut: string;
  Icon: React.ComponentType<{ className?: string }>;
};

export function ToolCard({
  ref,
  tool,
  top,
  left,
  notch,
  phase,
  label,
  desc,
  shortcut,
  Icon,
}: ToolCardProps) {
  const reduced = useReducedMotion();
  return (
    <div
      ref={ref}
      aria-hidden
      style={{ top, left }}
      className={cn(
        "pointer-events-none fixed z-50 w-[300px] rounded-xl border bg-card p-1.5 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.05)] transition-[top] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        phase === "in"
          ? "studio-tool-card"
          : phase === "out"
            ? "studio-tool-card-out"
            : "",
      )}
    >
      {/* 道具を指す小さな三角 */}
      <span
        style={{ top: notch }}
        className="absolute -left-[6px] size-2.5 rotate-45 border-b border-l bg-card transition-[top] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      />
      {/* 中身は道具ごとに作り直し、移ったときは軽くフェードで入れ替える */}
      <div
        key={tool}
        className={phase === "swap" ? "studio-tool-card-swap" : undefined}
      >
        {!reduced && (
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[var(--studio-map)]">
            <Icon className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />
            {/* biome-ignore lint/performance/noImgElement: 動き（GIF）をそのまま流す（画像の最適化をすると止まった絵になる） */}
            <img
              src={TOOL_GIFS[tool].src}
              alt=""
              className="relative block size-full object-cover"
            />
          </div>
        )}
        <div className="px-2 pt-2.5 pb-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Icon className="size-4" />
            {label}
            <kbd className="ml-auto rounded border px-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
              {shortcut}
            </kbd>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}
