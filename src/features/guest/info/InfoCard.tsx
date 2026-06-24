import type { ReactNode } from "react";

export type InfoCardProps = {
  title: string;
  children: ReactNode;
};

/**
 * ゲスト情報モジュール共通のカード枠。
 * 見出し（title）とコンテンツ（children）を受け取るだけの純粋な presentation。
 */
export function InfoCard({ title, children }: InfoCardProps) {
  return (
    <section className="h-full rounded-2xl border border-guest-line bg-guest-surface p-6 shadow-sm">
      <h2 className="text-sm font-medium tracking-wide text-guest-ink-muted">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
