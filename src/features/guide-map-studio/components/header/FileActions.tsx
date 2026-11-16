"use client";

import { BookmarkPlus, FilePlus, Sparkles, Upload } from "lucide-react";
import * as React from "react";
import { useI18n } from "../../i18n/i18n";

// マップの出し入れ（作る・見本・読み込む・保存ポイント）をひとまとめに。名前が折り返さないよう縮めない
export function FileActions({
  onNew,
  onSample,
  onImport,
  onSavePoints,
}: {
  onNew: () => void;
  onSample: () => void;
  /** 読み込むファイルを選んだ */
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSavePoints: () => void;
}) {
  const { t } = useI18n();
  const importRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-md border p-0.5 text-xs font-medium whitespace-nowrap">
        <button
          type="button"
          onClick={onNew}
          aria-label={t("新規作成")}
          title={t(
            "白紙のマップを新しいタブで作ります（いまのマップはそのまま残ります）",
          )}
          className="inline-flex h-full items-center gap-1.5 rounded px-2.5 hover:bg-accent"
        >
          <FilePlus className="size-4" />
          <span className="hidden min-[1360px]:inline">{t("新規作成")}</span>
        </button>
        <button
          type="button"
          onClick={onSample}
          aria-label={t("見本")}
          title={t("整列済みの見本の案内マップを読み込む")}
          className="inline-flex h-full items-center gap-1.5 rounded px-2.5 hover:bg-accent"
        >
          <Sparkles className="size-4" />
          <span className="hidden min-[1360px]:inline">{t("見本")}</span>
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          aria-label={t("読み込む")}
          title={t("読み込む")}
          className="inline-flex h-full items-center gap-1.5 rounded px-2.5 hover:bg-accent"
        >
          <Upload className="size-4" />
          <span className="hidden min-[1360px]:inline">{t("読み込む")}</span>
        </button>
        <button
          type="button"
          onClick={onSavePoints}
          title={t(
            "いまの地図を保存ポイントにしたり、保存ポイントの状態に戻したりします（⌘S で保存）",
          )}
          aria-label={t("保存ポイント")}
          className="inline-flex h-full items-center gap-1.5 rounded px-2.5 hover:bg-accent"
        >
          <BookmarkPlus className="size-4" />
          <span className="hidden min-[1360px]:inline">
            {t("保存ポイント")}
          </span>
        </button>
      </div>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImport}
      />
    </>
  );
}
