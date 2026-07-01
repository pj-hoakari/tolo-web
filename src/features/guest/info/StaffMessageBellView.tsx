import { Button } from "@/components/ui/button";
import { type StaffMessage, StaffMessageView } from "./StaffMessageView";

export type StaffMessageBellViewProps = {
  messages: StaffMessage[];
  /** 新着（未読）件数。0 のときはバッジを表示しない */
  unreadCount: number;
  /** 一覧パネルが開いているか */
  isOpen: boolean;
  /** ベル押下時のコールバック */
  onToggle: () => void;
  /** パネル見出し（省略時は日本語） */
  title?: string;
  /** ベルボタンの aria-label */
  ariaOpen?: string;
  /** 閉じる用 aria-label */
  ariaClose?: string;
  /** お知らせが無いときの文言 */
  emptyText?: string;
  /** 日時整形に使うロケール */
  locale?: string;
};

export function StaffMessageBellView({
  messages,
  unreadCount,
  isOpen,
  onToggle,
  title = "スタッフからのお知らせ",
  ariaOpen = "スタッフからのお知らせ",
  ariaClose = "お知らせを閉じる",
  emptyText,
  locale,
}: StaffMessageBellViewProps) {
  return (
    <div className="relative">
      <Button
        onPress={onToggle}
        aria-label={ariaOpen}
        aria-expanded={isOpen}
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
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-guest-notify px-1 font-bold text-secondary text-xs">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <Button
            aria-label={ariaClose}
            onPress={onToggle}
            variant="ghost"
            className="fixed inset-0 z-10 block h-auto w-auto cursor-default rounded-none bg-transparent p-0 hover:bg-transparent"
          />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-primary/12 bg-secondary p-4 shadow-lg">
            <h2 className="mb-3 font-medium text-primary/55 text-sm tracking-wide">
              {title}
            </h2>
            <StaffMessageView
              messages={messages}
              emptyText={emptyText}
              locale={locale}
            />
          </div>
        </>
      )}
    </div>
  );
}
