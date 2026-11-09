"use client";

// 右の設定などで使う入力欄（数字・階の名前・誘導の出発/目的地）

import * as React from "react";
import { useI18n } from "./i18n";
import type { Floor } from "./venueMap";

// 位置・大きさを数字で入れる欄。Enter・フォーカスが外れたときに確定する（矢印キーの増減はすぐ反映）
type NumFieldProps = {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
  min?: number;
};

export function NumField({
  label,
  value,
  onCommit,
  disabled,
  min,
}: NumFieldProps) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = (raw: string) => {
    const v = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(v))
      onCommit(min !== undefined ? Math.max(min, v) : v);
    setDraft(null);
  };
  return (
    <label className="flex min-w-0 items-center gap-1">
      <span className="w-4 shrink-0 font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        disabled={disabled}
        value={draft ?? String(Math.round(value))}
        onChange={(e) => {
          const ne = e.nativeEvent as InputEvent;
          // 矢印キー・スピンボタン（inputType が無い）はすぐ反映、打っている途中は確定まで待つ
          if (!ne.inputType) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onBlur={(e) => draft !== null && commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          else if (e.key === "Escape") setDraft(null);
        }}
        className="h-7 w-full min-w-0 rounded-md border border-input bg-transparent px-1.5 font-mono text-xs tabular-nums disabled:opacity-50"
      />
    </label>
  );
}

// 誘導プレビューの出発/目的地。フロアが複数なら階ごとにまとめる
type RoutePinSelectProps = {
  id?: string;
  label: string;
  value: string;
  pins: { id: string; label: string; floor: string }[];
  floors: Floor[];
  onChange: (id: string) => void;
};

export function RoutePinSelect({
  id,
  label,
  value,
  pins,
  floors,
  onChange,
}: RoutePinSelectProps) {
  const { t } = useI18n();
  return (
    <label className="flex items-center gap-2">
      <span className="w-12 text-muted-foreground">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2"
      >
        <option value="">{t("選択")}</option>
        {floors.length > 1
          ? floors.map((f) => {
              const ps = pins.filter((p) => p.floor === f.id);
              return ps.length ? (
                <optgroup key={f.id} label={f.name}>
                  {ps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}（{f.name}）
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })
          : pins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
      </select>
    </label>
  );
}

// フロア名の入力。Enter／フォーカスが外れたら確定、Esc で取消。前後の空白は除き、空なら元の名前に戻す。
type FloorNameInputProps = {
  name: string;
  onCommit: (name: string) => void;
  onDone?: () => void;
  autoFocus?: boolean;
  className?: string;
  label?: string;
  maxLength?: number;
};

export function FloorNameInput({
  name,
  onCommit,
  onDone,
  autoFocus,
  className,
  label,
  maxLength = 20,
}: FloorNameInputProps) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState(name);
  const finish = (commit: boolean) => {
    const v = draft.trim();
    if (commit && v && v !== name) onCommit(v);
    else setDraft(name);
    onDone?.();
  };
  return (
    <input
      value={draft}
      // biome-ignore lint/a11y/noAutofocus: 開いた・名前の編集を始めたときに、すぐ入力できるようにする
      autoFocus={autoFocus}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(name);
          finish(false);
        }
      }}
      maxLength={maxLength}
      aria-label={label ?? t("フロア名")}
      className={className}
    />
  );
}
