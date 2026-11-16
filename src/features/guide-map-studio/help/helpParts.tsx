import type * as React from "react";

// 使い方（Q&A）の 1 問と、そのまとまり。a（答え）は画面に出す文で、キーや画面の言葉を強調して書く
export type QA = { q: string; a: React.ReactNode; keywords?: string };
export type Section = { title: string; items: QA[] };

export const K = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded-md border px-1 py-0.5 font-mono text-[11px]">
    {children}
  </kbd>
);
export const B = ({ children }: { children: React.ReactNode }) => (
  <b className="font-medium text-foreground">{children}</b>
);
