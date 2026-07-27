import { Info, type LucideIcon, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoticeLevel } from "../../type";

const NOTICE_ICON: Record<NoticeLevel, LucideIcon> = {
  warning: TriangleAlert,
  info: Info,
};

const NOTICE_TEXT: Record<NoticeLevel, string> = {
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-accent-foreground",
};

export type PropertyNoticeProps = {
  className?: string;
  level?: NoticeLevel;
  message: string;
};

/** プロパティパネル内で制約違反や補足情報を伝える一行の通知 */
export function PropertyNotice({
  className,
  level = "warning",
  message,
}: PropertyNoticeProps) {
  const Icon = NOTICE_ICON[level];
  return (
    <p
      className={cn(
        "flex items-start gap-1 text-[10px]",
        NOTICE_TEXT[level],
        className,
      )}
    >
      <Icon aria-hidden className="mt-px size-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
