"use client";

import {
  Grid3x3,
  Map as MapIcon,
  Maximize,
  Ruler,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useI18n } from "../../i18n/i18n";

// 帯のボタンの見た目（小さな四角いアイコンボタン。入っているときは色を付ける）
const ICON_BUTTON = "size-7 px-0 text-foreground";
const ICON_TOGGLE =
  "size-7 px-0 text-foreground selected:bg-accent selected:text-primary";

// 地図の下の細い帯：マウスの位置（地図の座標）・グリッド線と定規と全体図の切り替え・全体を表示・拡大縮小
export function MapStatusBar({
  coordRef,
  showCoords,
  showRulerToggle,
  showGrid,
  onToggleGrid,
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
  /** グリッド線・定規の切り替えを出すか（プレビュー中は出さない） */
  showRulerToggle: boolean;
  showGrid: boolean;
  onToggleGrid: () => void;
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
        <>
          {/* グリッド線：作るときの目安（お客さんの画面には出ない） */}
          <Toggle
            isSelected={showGrid}
            onChange={onToggleGrid}
            aria-label={t("グリッド線")}
            className={ICON_TOGGLE}
          >
            <Grid3x3 aria-hidden className="size-4" />
          </Toggle>
          <Toggle
            isSelected={showRulers}
            onChange={onToggleRulers}
            aria-label={t("定規")}
            className={ICON_TOGGLE}
          >
            <Ruler aria-hidden className="size-4" />
          </Toggle>
        </>
      )}
      <Toggle
        isSelected={showMini}
        onChange={onToggleMini}
        aria-label={t("全体図")}
        className={ICON_TOGGLE}
      >
        <MapIcon aria-hidden className="size-4" />
      </Toggle>
      <Button
        variant="ghost"
        aria-label={t("全体を表示")}
        onPress={onFit}
        className={ICON_BUTTON}
      >
        <Maximize aria-hidden className="size-4" />
      </Button>
      <Button
        variant="ghost"
        aria-label={t("縮小")}
        onPress={() => onZoomBy(0.9)}
        className={ICON_BUTTON}
      >
        <ZoomOut aria-hidden className="size-4" />
      </Button>
      <Button
        variant="ghost"
        aria-label={t("拡大率を100%に戻す（いまは {n}%）", {
          n: Math.round(zoom * 100),
        })}
        onPress={onZoomReset}
        className="h-7 min-w-12 px-1 font-mono text-xs font-normal tabular-nums"
      >
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        variant="ghost"
        aria-label={t("拡大")}
        onPress={() => onZoomBy(1.1)}
        className={ICON_BUTTON}
      >
        <ZoomIn aria-hidden className="size-4" />
      </Button>
    </div>
  );
}
