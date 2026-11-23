"use client";

import type * as React from "react";
import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
} from "@/components/ui/disclosure";
import { cn } from "@/lib/utils";

// 右の設定の、開け閉めできるまとまり（「混雑を試す」「別の階へコピー」「階段・EVとして使う」など）。
// 見出しを押すと中身が開く。いつも使うわけではない操作をたたんでおき、設定を見やすくする
export function FoldSection({
  title,
  defaultExpanded = false,
  className,
  children,
}: {
  title: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Disclosure
      defaultExpanded={defaultExpanded}
      className={cn("min-w-0 rounded-md border px-2", className)}
    >
      <DisclosureHeader className="gap-2 py-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">{title}</span>
      </DisclosureHeader>
      <DisclosurePanel className="text-xs">{children}</DisclosurePanel>
    </Disclosure>
  );
}
