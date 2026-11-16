"use client";

import { Map as MapIcon, Maximize, Ruler, ZoomIn, ZoomOut } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "../../i18n/i18n";

// 地図の下の細い帯：マウスの位置（地図の座標）・定規と全体図の切り替え・全体を表示・拡大縮小
export function MapStatusBar({
  coordRef,
  showCoords,
  showRulerToggle,
  showRulers,
  onToggleRulers,
  showMini,
  onToggleMini,
  zoom,
  onFit,
  onZoomBy,
  onZoomReset,
}: {
  /** マウスの位置を書き込む所（マウスを動かすたびに画面全体を描き直さないよう、直接書き換える） */
  coordRef: React.RefObject<HTMLSpanElement | null>;
  showCoords: boolean;
  /** 定規の切り替えを出すか（プレビュー中は出さない） */
  showRulerToggle: boolean;
  showRulers: boolean;
  onToggleRulers: () => void;
  showMini: boolean;
  onToggleMini: () => void;
  zoom: number;
  onFit: () => void;
  onZoomBy: (factor: number) => void;
  onZoomReset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-t px-2">
      {/* マウスの位置（地図の座標） */}
      {showCoords && (
        <span
          ref={coordRef}
          aria-live="off"
          className="min-w-[7.5rem] px-1.5 font-mono text-[11px] text-muted-foreground tabular-nums"
        />
      )}
      <span className="flex-1" />
      {showRulerToggle && (
        <button
          type="button"
          aria-pressed={showRulers}
          aria-label={t("定規")}
          title={showRulers ? t("定規（座標）を隠す") : t("定規（座標）を出す")}
          onClick={onToggleRulers}
          className={cn(
            "flex size-7 items-center justify-center rounded-md",
            showRulers ? "bg-accent text-primary" : "hover:bg-accent",
          )}
        >
          <Ruler className="size-4" />
        </button>
      )}
      <button
        type="button"
        aria-pressed={showMini}
        aria-label={t("全体図")}
        title={showMini ? t("全体図を隠す") : t("全体図を出す")}
        onClick={onToggleMini}
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          showMini ? "bg-accent text-primary" : "hover:bg-accent",
        )}
      >
        <MapIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t("全体を表示")}
        title={t("全体を表示")}
        onClick={onFit}
        className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
      >
        <Maximize className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t("縮小")}
        onClick={() => onZoomBy(0.9)}
        className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
      >
        <ZoomOut className="size-4" />
      </button>
      <button
        type="button"
        onClick={onZoomReset}
        className="min-w-12 rounded-md px-1 text-center font-mono text-xs tabular-nums hover:bg-accent"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label={t("拡大")}
        onClick={() => onZoomBy(1.1)}
        className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
      >
        <ZoomIn className="size-4" />
      </button>
    </div>
  );
}
