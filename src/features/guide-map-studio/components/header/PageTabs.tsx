"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "../../i18n/i18n";
import type { StudioPage } from "../../type";
import { FloorNameInput } from "../parts/Fields";

// マップのタブ（エクセルのシートのように、別々のマップを切り替える）。
// ドラッグで並べ替え・ダブルクリックで名前を変更・右クリックでメニュー
export function PageTabs({
  pages,
  activePageId,
  pageName,
  editingPageId,
  onEdit,
  onRename,
  onGo,
  onMove,
  onMenu,
  onAdd,
}: {
  pages: StudioPage[];
  activePageId: string;
  pageName: (page: StudioPage, index: number) => string;
  /** 名前を編集中のタブ */
  editingPageId: string | null;
  /** 名前の編集を始める・終える（null） */
  onEdit: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onGo: (id: string) => void;
  /** 指定した位置の前へ移す */
  onMove: (id: string, to: number) => void;
  onMenu: (x: number, y: number, id: string) => void;
  onAdd: () => void;
}) {
  const { t } = useI18n();
  // 並べ替え（ドラッグ中）。to＝入れる位置
  const [pageDrag, setPageDrag] = React.useState<{
    id: string;
    to: number | null;
  } | null>(null);
  return (
    <div
      role="tablist"
      aria-label={t("マップのタブ")}
      className="studio-thin-scroll flex min-w-[6.5rem] items-center gap-1 overflow-x-auto"
    >
      {pages.map((p, i) =>
        editingPageId === p.id ? (
          <FloorNameInput
            key={p.id}
            name={pageName(p, i)}
            label={t("マップ名")}
            maxLength={30}
            autoFocus
            onCommit={(name) => onRename(p.id, name)}
            onDone={() => onEdit(null)}
            className="h-8 w-36 shrink-0 rounded-md border-2 border-primary bg-transparent px-3 text-xs font-medium"
          />
        ) : (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === activePageId}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", p.id);
              e.dataTransfer.effectAllowed = "move";
              setPageDrag({ id: p.id, to: null });
            }}
            onDragOver={(e) => {
              if (!pageDrag) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const to = e.clientX < r.left + r.width / 2 ? i : i + 1;
              if (pageDrag.to !== to) setPageDrag({ ...pageDrag, to });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (pageDrag && pageDrag.to !== null)
                onMove(pageDrag.id, pageDrag.to);
              setPageDrag(null);
            }}
            onDragEnd={() => setPageDrag(null)}
            onClick={() => onGo(p.id)}
            onDoubleClick={() => onEdit(p.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onGo(p.id);
              onMenu(e.clientX, e.clientY, p.id);
            }}
            title={t(
              "ドラッグで並べ替え／ダブルクリックで名前を変更／右クリックでメニュー",
            )}
            className={cn(
              "relative flex h-8 max-w-44 shrink-0 items-center truncate rounded-md px-3 text-xs",
              p.id === activePageId
                ? "bg-accent font-medium text-primary"
                : "text-muted-foreground hover:bg-accent/60",
              pageDrag?.id === p.id && "opacity-40",
              pageDrag &&
                pageDrag.to === i &&
                "before:absolute before:top-0 before:-left-1 before:h-full before:w-0.5 before:rounded before:bg-primary",
              pageDrag &&
                pageDrag.to === i + 1 &&
                i === pages.length - 1 &&
                "after:absolute after:top-0 after:-right-1 after:h-full after:w-0.5 after:rounded after:bg-primary",
            )}
          >
            <span className="truncate">{pageName(p, i)}</span>
          </button>
        ),
      )}
      <button
        type="button"
        onClick={onAdd}
        title={t("新しいマップのタブを追加")}
        aria-label={t("新しいマップのタブを追加")}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
