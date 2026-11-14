"use client";

// 2つのタブを左右に並べて見比べる。階は名前でそろえて、両方いっしょに切り替える

import { Columns2, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n";
import type { StudioPage } from "./venueMap";
import { type FloorSvgOptions, floorSvg } from "./venueMapSvg";

export type CompareState = {
  left: string;
  right: string;
  floor: number;
  floorName: string;
};

type CompareDialogProps = {
  compare: CompareState;
  pages: StudioPage[];
  pageName: (p: StudioPage, i: number) => string;
  svgOptions: FloorSvgOptions;
  onChange: (next: CompareState) => void;
  onOpenPage: (id: string) => void;
  onExport: (id: string) => void;
  onClose: () => void;
};

export function CompareDialog({
  compare,
  pages,
  pageName,
  svgOptions,
  onChange,
  onOpenPage,
  onExport,
  onClose,
}: CompareDialogProps) {
  const { t } = useI18n();
  return (
    <div
      data-keep-selection
      className="fixed inset-0 z-[90] flex flex-col bg-background p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-title"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="mb-4 flex items-center gap-3">
        <h2 id="compare-title" className="flex items-center gap-2 text-lg">
          <Columns2 className="size-5" />
          {t("見比べる")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("左右で別のタブを選べます。階の切り替えは両方そろって動きます。")}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          // biome-ignore lint/a11y/noAutofocus: 開いたときにフォーカスを中へ移し、Esc で閉じられるようにする（React Aria の Dialog に置き換えるまで）
          autoFocus
          onClick={onClose}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
        >
          <X className="size-4" />
          {t("閉じる")}
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        {(["left", "right"] as const).map((side) => {
          const pid = compare[side];
          const pi = Math.max(
            0,
            pages.findIndex((p) => p.id === pid),
          );
          const pd = pages[pi].doc;
          // 同じ名前の階を出す（並びが違っても「3F」どうしを比べる）。無ければ同じ位置の階
          const byName = pd.floors.findIndex(
            (f) => f.name === compare.floorName,
          );
          const fi =
            byName >= 0
              ? byName
              : Math.min(compare.floor, pd.floors.length - 1);
          const { svg } = floorSvg(pd, pd.floors[fi].id, svgOptions);
          return (
            <section
              key={side}
              className="flex min-h-0 flex-col rounded-lg border bg-card"
            >
              <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <select
                  value={pages[pi].id}
                  onChange={(e) =>
                    onChange({ ...compare, [side]: e.target.value })
                  }
                  aria-label={t("見比べるタブ")}
                  className="h-8 min-w-0 rounded-md border border-input bg-transparent px-2 text-sm font-medium"
                >
                  {pages.map((p, i) => (
                    <option key={p.id} value={p.id}>
                      {pageName(p, i)}
                    </option>
                  ))}
                </select>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {t("{f}フロア・{n}件", {
                    f: pd.floors.length,
                    n: pd.objects.length,
                  })}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => onOpenPage(pages[pi].id)}
                  className="h-8 rounded-md border px-2.5 text-xs hover:bg-accent"
                >
                  {t("このタブを開く")}
                </button>
                <button
                  type="button"
                  onClick={() => onExport(pages[pi].id)}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground"
                >
                  <Download className="size-3.5" />
                  {t("これを書き出す")}
                </button>
              </div>
              <div className="flex flex-wrap gap-1 px-4 pt-3">
                {pd.floors.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      onChange({ ...compare, floor: i, floorName: f.name })
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-0.5 font-mono text-xs",
                      i === fi
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              {/* 地図は画像として出す（小さな地図は拡大しすぎず、大きな地図は枠に収める） */}
              <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                {/* biome-ignore lint/performance/noImgElement: SVG の data URL をそのまま出す（画像の最適化は要らない） */}
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                  alt={`${pageName(pages[pi], pi)} ${pd.floors[fi].name}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
