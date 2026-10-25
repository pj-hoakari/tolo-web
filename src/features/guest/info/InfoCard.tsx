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
    <section className="rounded-2xl border border-primary/12 bg-secondary p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-medium tracking-wide text-primary/55">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
