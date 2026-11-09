"use client";

// 新規作成：どんなマップ（建物＝階あり／会場＝階なし）を作るか選ぶ

import { Building2, FilePlus, Trees } from "lucide-react";
import { useI18n } from "./i18n";
import { Modal } from "./Modal";

export function NewMapDialog({
  onPick,
  onClose,
}: {
  onPick: (kind: "building" | "venue") => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal
      labelledBy="newmap-title"
      className="w-full max-w-xl"
      onClose={onClose}
    >
      <h2 id="newmap-title" className="flex items-center gap-2 text-base">
        <FilePlus className="size-4" />
        {t("どんなマップを作りますか？")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "白紙のマップを新しいタブで作ります。いまのマップはそのまま残ります。",
        )}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              kind: "building",
              title: t("建物（階あり）"),
              text: t(
                "校舎やビルなど。1F から始めて、2F・3F…と階を増やし、階段やエレベーターでつなげます。",
              ),
              icon: <Building2 className="size-6" />,
            },
            {
              kind: "venue",
              title: t("会場（階なし）"),
              text: t(
                "屋外のお祭り会場や広場など、階の無い場所を1枚の地図で作ります。あとから階を足すこともできます。",
              ),
              icon: <Trees className="size-6" />,
            },
          ] as const
        ).map((c, i) => (
          <button
            key={c.kind}
            type="button"
            // biome-ignore lint/a11y/noAutofocus: 開いたときにフォーカスを中へ移し、Esc で閉じられるようにする（React Aria の Dialog に置き換えるまで）
            autoFocus={i === 0}
            onClick={() => onPick(c.kind)}
            className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:border-primary hover:bg-accent"
          >
            <span className="text-primary">{c.icon}</span>
            <span className="text-sm font-medium">{c.title}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              {c.text}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-md border px-3 text-xs hover:bg-accent"
        >
          {t("キャンセル")}
        </button>
      </div>
    </Modal>
  );
}
