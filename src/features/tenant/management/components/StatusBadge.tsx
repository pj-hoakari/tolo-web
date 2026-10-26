import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "warning" | "info" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  positive:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
};

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-xs",
        tones[tone],
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
