"use client";

import { SizeSlider } from "./SizeSlider";

// 倍率（%）のスライダー（名前の大きさ・マークの大きさ）。50% から、5% 刻み。
// 100% は「ふだんの大きさ」なので、値を持たない（undefined）ことで表す
export function ScaleSlider({
  label,
  value,
  max,
  snaps,
  defaultLabel,
  onChange,
}: {
  label: string;
  /** 倍率（無し＝1＝100%） */
  value: number | undefined;
  /** いちばん大きい倍率（%） */
  max: number;
  /** ドラッグ中に止まる倍率（%） */
  snaps: readonly number[];
  /** 100% のときに出す言葉（「自動（100%）」など） */
  defaultLabel: string;
  onChange: (scale: number | undefined) => void;
}) {
  return (
    <SizeSlider
      label={label}
      value={Math.round((value ?? 1) * 100)}
      min={50}
      max={max}
      step={5}
      snaps={snaps}
      unit="%"
      format={(v) => (v === 100 ? defaultLabel : `${v}%`)}
      onChange={(v) => onChange(v === 100 ? undefined : v / 100)}
    />
  );
}
