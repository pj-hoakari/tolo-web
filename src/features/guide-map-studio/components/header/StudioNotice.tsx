import type * as React from "react";
import { GUIDE } from "../../utils/shared";

// 上の帯の下に出す知らせ（読み込めなかった・ブラウザに保存できなかったなど）。右に、直すためのボタンを置く
export function StudioNotice({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  /** 右に置くボタン */
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-3 border-b border-primary bg-card px-4 py-2 text-sm"
    >
      <span
        className="size-2 shrink-0 rounded-sm"
        style={{ background: GUIDE }}
      />
      <span className="min-w-0 flex-1">
        <b className="font-medium">{title}</b>
        {message}
      </span>
      {children}
    </div>
  );
}
