"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

// 画面の真ん中に出す小さな画面（暗い背景つき）。背景を押すと閉じ、Esc では onEscape（無ければ閉じる）
type ModalProps = {
  labelledBy: string;
  className?: string;
  onClose: () => void;
  onEscape?: () => void;
  tabIndex?: number;
  children: React.ReactNode;
};

export function Modal({
  labelledBy,
  className,
  onClose,
  onEscape = onClose,
  tabIndex,
  children,
}: ModalProps) {
  return (
    <div
      data-keep-selection
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={tabIndex}
        className={cn("studio-fade rounded-lg border bg-card p-5", className)}
        onKeyDown={(e) => e.key === "Escape" && onEscape()}
      >
        {children}
      </div>
    </div>
  );
}
