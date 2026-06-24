export type StaffMessage = {
  /** クライアントが既読・重複を判定するための識別子 */
  id: string;
  /** メッセージ本文（表示言語で解決済み） */
  body: string;
  /** 送信スタッフの名前（表示言語で解決済み） */
  staffName: string;
  /** 送信スタッフの役職（表示言語で解決済み） */
  staffRole: string;
  /** 配信日時（ISO 8601） */
  deliveredAt: string;
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
    return <p className="text-guest-ink-muted text-sm">{emptyText}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {messages.map((message) => (
        <li
          key={message.id}
          className="rounded-xl border border-guest-line bg-guest-surface-muted p-4"
        >
          <p className="whitespace-pre-wrap text-guest-ink text-sm leading-relaxed">
            {message.body}
          </p>
          <div className="mt-3 flex items-center justify-between text-guest-ink-muted text-xs">
            <span>
              {message.staffName}
              <span className="ml-1 text-guest-ink-muted">
                {message.staffRole}
              </span>
            </span>
            <time dateTime={message.deliveredAt}>
              {dateFormatter.format(new Date(message.deliveredAt))}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
