"use client";

// 保存ポイント：いまの地図に名前を付けて残し、あとでその状態に戻す（名前の変更・削除・新しいタブで開く）

import { BookmarkPlus, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n";
import { Modal } from "./Modal";
import type { Snapshot } from "./snapshots";
import { floorSvg, type SvgTheme } from "./venueMapSvg";

/** 保存ポイントの日時（例：11/9 14:05） */
export const snapshotClock = (at: number) => {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

type SnapshotsDialogProps = {
  list: Snapshot[] | "loading";
  now: number;
  activeFloorId: string;
  theme: SvgTheme;
  onSave: (label: string) => Promise<boolean>;
  onRename: (id: number, label: string) => Promise<void>;
  onRestore: (snap: Snapshot, saveFirst: boolean) => void;
  onRemove: (id: number) => void;
  onOpenInTab: (snap: Snapshot) => void;
  onClose: () => void;
};

export function SnapshotsDialog({
  list,
  now,
  activeFloorId,
  theme,
  onSave,
  onRename,
  onRestore,
  onRemove,
  onOpenInTab,
  onClose,
}: SnapshotsDialogProps) {
  const { t } = useI18n();
  const [snapLabel, setSnapLabel] = React.useState(""); // 新しく作る保存ポイントの名前
  const [snapEdit, setSnapEdit] = React.useState<{
    id: number;
    label: string;
  } | null>(null); // 名前を変えている保存ポイント
  const [histConfirm, setHistConfirm] = React.useState<{
    id: number;
    kind: "restore" | "delete";
  } | null>(null); // 「戻す」「削除」の確認
  const commitSnapEdit = async () => {
    if (!snapEdit) return;
    setSnapEdit(null);
    await onRename(snapEdit.id, snapEdit.label.trim());
  };
  // 開いた時刻からどれくらい前か
  const ago = (at: number) => {
    const m = Math.floor((now - at) / 60_000);
    if (m < 1) return t("たった今");
    if (m < 60) return t("{n}分前", { n: m });
    if (m < 60 * 24) return t("{n}時間前", { n: Math.floor(m / 60) });
    return t("{n}日前", { n: Math.floor(m / 60 / 24) });
  };
  return (
    <Modal
      labelledBy="history-title"
      className="flex max-h-[85vh] w-full max-w-2xl flex-col outline-none"
      onClose={onClose}
      onEscape={() => (histConfirm ? setHistConfirm(null) : onClose())}
      tabIndex={-1}
    >
      <h2 id="history-title" className="flex items-center gap-2 text-base">
        <BookmarkPlus className="size-4" />
        {t("保存ポイント")}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t(
          "いまの地図に名前を付けて保存しておき、あとでその状態に戻せます（⌘S でも保存できます）。案を試す前などに作っておくと安心です。このブラウザの中だけに残り、ページを開き直しても使えます。",
        )}
      </p>
      {/* いまの状態を残す */}
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(snapLabel).then((ok) => ok && setSnapLabel(""));
        }}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: 開いた・名前の編集を始めたときに、すぐ入力できるようにする
          autoFocus
          value={snapLabel}
          onChange={(e) => setSnapLabel(e.target.value)}
          maxLength={40}
          placeholder={t("名前（任意）例：案A・入口を広げる前")}
          aria-label={t("保存ポイントの名前")}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
        >
          <Plus className="size-3.5" />
          {t("いまの状態を保存")}
        </button>
      </form>
      {list === "loading" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("読み込んでいます…")}
        </p>
      ) : list.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t(
            "まだ保存ポイントがありません。名前を入れて「いまの状態を保存」を押すと作れます。",
          )}
        </p>
      ) : (
        <ul className="studio-thin-scroll mt-3 flex min-h-0 flex-col gap-1.5 overflow-auto">
          {list.map((snap, i) => {
            const fl =
              snap.doc.floors.find((f) => f.id === activeFloorId) ??
              snap.doc.floors[0];
            const thumb = floorSvg(snap.doc, fl.id, { theme });
            const confirming =
              histConfirm && histConfirm.id === snap.id
                ? histConfirm.kind
                : null;
            return (
              <li
                key={snap.id ?? i}
                className={cn(
                  "rounded-md border p-2",
                  confirming && "border-primary",
                )}
              >
                <div className="flex items-center gap-3">
                  {/* biome-ignore lint/performance/noImgElement: SVG の data URL をそのまま出す（画像の最適化は要らない） */}
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumb.svg)}`}
                    alt=""
                    className="h-14 w-24 shrink-0 rounded border bg-background object-contain"
                  />
                  <span className="min-w-0 flex-1">
                    {snapEdit && snapEdit.id === snap.id ? (
                      <input
                        // biome-ignore lint/a11y/noAutofocus: 開いた・名前の編集を始めたときに、すぐ入力できるようにする
                        autoFocus
                        value={snapEdit.label}
                        maxLength={40}
                        onChange={(e) =>
                          setSnapEdit({
                            id: snapEdit.id,
                            label: e.target.value,
                          })
                        }
                        onBlur={() => void commitSnapEdit()}
                        onKeyDown={(e) => {
                          // 入力欄が消えても Esc で閉じられるよう、ダイアログにフォーカスを戻す
                          const dialog =
                            e.currentTarget.closest<HTMLElement>(
                              "[role=dialog]",
                            );
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            dialog?.focus();
                            void commitSnapEdit();
                          }
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setSnapEdit(null);
                            dialog?.focus();
                          }
                        }}
                        placeholder={t("名前（任意）例：案A・入口を広げる前")}
                        aria-label={t("保存ポイントの名前")}
                        className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          snap.id !== undefined &&
                          setSnapEdit({ id: snap.id, label: snap.label ?? "" })
                        }
                        title={t("名前を変える")}
                        className="group -mx-1 flex max-w-full items-center gap-1.5 rounded px-1 text-left text-sm font-medium hover:bg-accent"
                      >
                        <span
                          className={cn(
                            "truncate",
                            !snap.label && "text-muted-foreground",
                          )}
                        >
                          {snap.label || t("（名前なし）")}
                        </span>
                        <Pencil className="size-3 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
                      </button>
                    )}
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {ago(snap.at)} · {snapshotClock(snap.at)} ·{" "}
                      {t("{f}フロア・{n}件", {
                        f: snap.doc.floors.length,
                        n: snap.doc.objects.length,
                      })}
                    </span>
                  </span>
                  {!confirming && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenInTab(snap)}
                        className="h-8 shrink-0 rounded-md border px-2.5 text-xs hover:bg-accent"
                      >
                        {t("新しいタブで開く")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          snap.id !== undefined &&
                          setHistConfirm({ id: snap.id, kind: "restore" })
                        }
                        className="h-8 shrink-0 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground"
                      >
                        {t("この状態に戻す")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          snap.id !== undefined &&
                          setHistConfirm({ id: snap.id, kind: "delete" })
                        }
                        aria-label={t("この保存ポイントを削除")}
                        title={t("この保存ポイントを削除")}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
                {/* 戻す・削除の前の確認 */}
                {confirming && (
                  <div
                    role="alert"
                    className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-background px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 leading-relaxed">
                      {confirming === "restore"
                        ? t(
                            "いまの地図が、この状態に置き換わります。いまの地図を残しておきたいときは「保存してから戻す」を選んでください（戻した直後なら ⌘Z でも取り消せます）。",
                          )
                        : t(
                            "この保存ポイントを削除します。削除すると元に戻せません。",
                          )}
                    </span>
                    <button
                      type="button"
                      // biome-ignore lint/a11y/noAutofocus: 開いたときにフォーカスを中へ移し、Esc で閉じられるようにする（React Aria の Dialog に置き換えるまで）
                      autoFocus
                      onClick={() => setHistConfirm(null)}
                      className="h-7 rounded-md border px-2.5 hover:bg-accent"
                    >
                      {t("キャンセル")}
                    </button>
                    {confirming === "restore" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onRestore(snap, false)}
                          className="h-7 rounded-md border px-2.5 hover:bg-accent"
                        >
                          {t("保存せずに戻す")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRestore(snap, true)}
                          className="h-7 rounded-md bg-primary px-2.5 font-medium text-primary-foreground"
                        >
                          {t("保存してから戻す")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (snap.id === undefined) return;
                          setHistConfirm(null);
                          onRemove(snap.id);
                        }}
                        className="h-7 rounded-md bg-primary px-2.5 font-medium text-primary-foreground"
                      >
                        {t("削除する")}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-md border px-3 text-xs hover:bg-accent"
        >
          {t("閉じる")}
        </button>
      </div>
    </Modal>
  );
}
