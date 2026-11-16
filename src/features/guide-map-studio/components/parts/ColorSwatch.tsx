"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "../../i18n/i18n";
import { PALETTE, type PaletteKey } from "../../utils/guideMapDoc";
import { KindIcon } from "./StudioIcons";

// 色（場所の種類）えらびのボタン。種類にはマークを重ね、selected のときは枠を光らせる。大きさは className で決める
export function ColorSwatch({
  k,
  selected,
  className,
  ...props
}: {
  k: PaletteKey;
  selected?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-label={t(PALETTE[k].label)}
      title={t(PALETTE[k].label)}
      className={cn(
        "rounded-md border",
        className,
        selected && "ring-2 ring-primary ring-offset-1",
      )}
      style={{ background: PALETTE[k].fill }}
      {...props}
    >
      <KindIcon kind={k} />
    </button>
  );
}
