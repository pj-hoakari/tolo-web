"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";

/**
 * React Aria のリンク（`@/components/ui/link` など）に Next の router を渡し、
 * ページ全体の再読み込みではなくクライアント遷移させる。
 */
export function AriaRouterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <RouterProvider navigate={(href, options) => router.push(href, options)}>
      {children}
    </RouterProvider>
  );
}
