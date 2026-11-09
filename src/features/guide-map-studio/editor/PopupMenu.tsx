"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// 右クリックメニュー。x・y の位置に出し、画面からはみ出すときは内側へずらす。外を押す（右クリックも）と閉じる
type PopupMenuProps = {
  x: number;
  y: number;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
};

export function PopupMenu({
  x,
  y,
  onClose,
  className,
  children,
}: PopupMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    el.style.left = `${Math.max(pad, Math.min(x, window.innerWidth - el.offsetWidth - pad))}px`;
    el.style.top = `${Math.max(pad, Math.min(y, window.innerHeight - el.offsetHeight - pad))}px`;
  }, [x, y]);
  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 外を押したら閉じるための背景（キーボードでは Esc で閉じる） */}
      <div
        data-keep-selection
        className="fixed inset-0 z-50"
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={ref}
        data-keep-selection
        className={cn(
          "studio-fade studio-thin-scroll fixed z-50 max-h-[calc(100vh-16px)] overflow-y-auto rounded-md border bg-card p-1.5 text-xs",
          className,
        )}
        style={{ left: x, top: y }}
      >
        {children}
      </div>
    </>
  );
}
