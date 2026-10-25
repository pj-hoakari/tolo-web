import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverDialog,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type StaffMessage, StaffMessageView } from "./StaffMessageView";

export type StaffMessageBellViewProps = {
  messages: StaffMessage[];
  /** 新着（未読）件数。0 のときはバッジを表示しない */
  unreadCount: number;
  /** 一覧パネルが開いているか */
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** パネル見出し（省略時は日本語） */
  title?: string;
  /** ベルボタンの aria-label */
  ariaOpen?: string;
  /** お知らせが無いときの文言 */
  emptyText?: string;
  /** 日時整形に使うロケール */
  locale?: string;
};

export function StaffMessageBellView({
  messages,
  unreadCount,
  isOpen,
  onOpenChange,
  title = "スタッフからのお知らせ",
  ariaOpen = "スタッフからのお知らせ",
  emptyText,
  locale,
}: StaffMessageBellViewProps) {
  const titleId = useId();

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button
        aria-label={ariaOpen}
        variant="ghost"
        size="icon"
        className="relative h-10 w-10 rounded-full border border-primary/12 bg-secondary text-primary/55 hover:bg-secondary hover:text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-guest-notify px-1 text-xs font-bold text-secondary">
            {unreadCount}
          </span>
        )}
      </Button>
      <Popover
        placement="bottom end"
        offset={8}
        className="guest-theme w-80 rounded-2xl border-primary/12 bg-secondary shadow-lg"
      >
        <PopoverDialog aria-labelledby={titleId}>
          <h2
            id={titleId}
            className="mb-3 text-sm font-medium tracking-wide text-primary/55"
          >
            {title}
          </h2>
          <StaffMessageView
            messages={messages}
            emptyText={emptyText}
            locale={locale}
          />
        </PopoverDialog>
      </Popover>
    </PopoverTrigger>
  );
}
