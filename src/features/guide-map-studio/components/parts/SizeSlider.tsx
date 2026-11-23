"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import {
  Slider,
  SliderFillTrack,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider";
import { Input, TextField } from "@/components/ui/textfield";
import { useI18n } from "../../i18n/i18n";

// 大きさを変えるスライダー（名前の大きさ・文字サイズ・マークの大きさ・幅／高さ）。
// 見出しと、いまの値を上に並べ、その下につまみを出す。キーボードの矢印でも 1 刻みずつ動かせる。
// 値（「158px」など）を押すと数字を打ち込める。Enter か、ほかを押すと決まり、Esc でやめる
export function SizeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "px",
  format = (v) => `${v}${unit}`,
  typedMax = max,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 数字の後ろに付ける単位（打ち込む欄の横にも出す） */
  unit?: string;
  format?: (value: number) => string;
  /** 打ち込むときの上限（スライダーの上限より大きい値も打ち込めるようにするとき） */
  typedMax?: number;
  /** 固定している物など、変えられないとき */
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };
  // 打ち込んだ数字を決める。数字でなければ何もしない。範囲の外なら範囲の中に収める
  const commit = () => {
    setEditing(false);
    const v = Number(draft.trim());
    if (draft.trim() === "" || !Number.isFinite(v)) return;
    const next = Math.round(Math.min(typedMax, Math.max(min, v)));
    if (next !== value) onChange(next);
  };
  return (
    <Slider
      value={Math.min(max, Math.max(min, value))}
      minValue={min}
      maxValue={max}
      step={step}
      isDisabled={disabled}
      onChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      className="grid gap-1.5"
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <Label className="text-xs font-normal text-muted-foreground">
          {label}
        </Label>
        {editing ? (
          <TextField
            aria-label={label}
            value={draft}
            onChange={setDraft}
            autoFocus
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex items-center gap-1"
          >
            <Input
              inputMode="numeric"
              className="h-6 w-16 px-1.5 text-right font-mono text-xs"
            />
            <span className="font-mono text-xs text-muted-foreground">
              {unit}
            </span>
          </TextField>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            isDisabled={disabled}
            onPress={startEdit}
            aria-label={t("{label}を数字で入力（いまは {value}）", {
              label,
              value: format(value),
            })}
            className="h-6 px-1.5 font-mono text-xs font-normal tabular-nums underline decoration-dotted underline-offset-2"
          >
            {format(value)}
          </Button>
        )}
      </div>
      <SliderTrack className="h-1.5">
        <SliderFillTrack />
        <SliderThumb className="size-4" />
      </SliderTrack>
    </Slider>
  );
}
