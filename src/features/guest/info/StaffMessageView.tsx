export type StaffMessage = {
  /** クライアントが既読・重複を判定するための識別子 */
  id: string;
  /** メッセージ本文 */
  body: string;
  /** 配信日時（ISO 8601） */
  deliveredAt: string | null;
};

export type StaffMessageViewProps = {
  messages: StaffMessage[];
  /** 空のときの文言（省略時は日本語） */
  emptyText?: string;
  /** 日時整形に使うロケール（省略時は ja-JP） */
  locale?: string;
};

/** スタッフからのお知らせ一覧（カード枠を持たない純粋なリスト表示） */
export function StaffMessageView({
  messages,
  emptyText = "現在お知らせはありません",
  locale = "ja-JP",
}: StaffMessageViewProps) {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (messages.length === 0) {
    return <p className="text-sm text-primary/55">{emptyText}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {messages.map((message) => (
        <li
          key={message.id}
          className="rounded-xl border border-primary/12 bg-primary/15 p-4"
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-primary">
            {message.body}
          </p>
          {message.deliveredAt && (
            <time
              dateTime={message.deliveredAt}
              className="mt-3 block text-right text-xs text-primary/55"
            >
              {dateFormatter.format(new Date(message.deliveredAt))}
            </time>
          )}
        </li>
      ))}
    </ul>
  );
}
