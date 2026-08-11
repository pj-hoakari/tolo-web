import { createContext, useContext, useRef } from "react";
import { MenuPopover } from "@/components/ui/menu";

export type ContextMenuPosition = { x: number; y: number };

/** メニュー項目が操作後に自身のメニューを閉じるための close コールバック */
const ContextMenuCloseContext = createContext<(() => void) | null>(null);

/** ContextMenuPopover 配下でメニューを閉じる関数を取得する */
export function useContextMenuClose(): () => void {
  const close = useContext(ContextMenuCloseContext);
  if (!close) {
    throw new Error(
      "useContextMenuClose は ContextMenuPopover の配下でのみ使用できる",
    );
  }
  return close;
}

/**
 * 右クリック位置に開くポップオーバーの共通部分。
 * React Aria の Popover はトリガー要素を要求するため、
 * クリック位置に置いた不可視アンカーを位置決めに使う。
 */
export function ContextMenuPopover({
  position,
  className,
  onClose,
  children,
}: {
  position: ContextMenuPosition;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);

  return (
    <>
      {/* React Aria Popover の位置決め専用アンカー */}
      <span
        ref={anchorRef}
        aria-hidden="true"
        className="pointer-events-none fixed size-px"
        style={{ left: position.x, top: position.y }}
      />
      <MenuPopover
        isOpen
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
        triggerRef={anchorRef}
        placement="bottom start"
        offset={0}
        className={className}
      >
        <ContextMenuCloseContext.Provider value={onClose}>
          {children}
        </ContextMenuCloseContext.Provider>
      </MenuPopover>
    </>
  );
}
