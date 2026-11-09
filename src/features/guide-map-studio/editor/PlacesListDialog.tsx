"use client";

// 場所の一覧表：部屋・目印などを表で見て、名前や色を直す。「表示」でその場所へ移る

import { Table2 } from "lucide-react";
import { ColorSwatch } from "./ColorSwatch";
import { useI18n } from "./i18n";
import { Modal } from "./Modal";
import {
  isConnector,
  type MapObject,
  PALETTE_KEYS,
  shownColorOf,
  type VenueMapDoc,
} from "./venueMap";

/** 一覧の絞り込み（floor＝階。空はすべての階） */
export type PlacesFilter = { floor: string; query: string; unnamed: boolean };

type PlacesListDialogProps = {
  doc: VenueMapDoc;
  floorName: (id: string) => string;
  filter: PlacesFilter;
  onFilter: (next: PlacesFilter) => void;
  onChange: (id: string, patch: Partial<MapObject>) => void;
  onShow: (id: string) => void;
  onClose: () => void;
};

export function PlacesListDialog({
  doc,
  floorName,
  filter,
  onFilter,
  onChange,
  onShow,
  onClose,
}: PlacesListDialogProps) {
  const { t, connectorName } = useI18n();
  const q = filter.query.trim().normalize("NFKC").toLowerCase();
  const order = new Map(doc.floors.map((f, i) => [f.id, i]));
  const rows = doc.objects
    .filter((o) => o.kind !== "route")
    .filter((o) => !filter.floor || o.floor === filter.floor)
    .filter((o) => !filter.unnamed || !o.title?.trim())
    .filter(
      (o) => !q || (o.title ?? "").normalize("NFKC").toLowerCase().includes(q),
    )
    .sort((a, b) => (order.get(a.floor) ?? 0) - (order.get(b.floor) ?? 0));
  const kindOf = (o: MapObject) =>
    isConnector(o)
      ? connectorName(o.connector)
      : o.kind === "place"
        ? o.shape === "pin"
          ? t("目印（ピン）")
          : o.shape === "circle"
            ? t("丸い区画")
            : t("部屋・区画")
        : o.kind === "area"
          ? t("範囲")
          : t("文字");
  return (
    <Modal
      labelledBy="list-title"
      className="flex h-[85vh] w-full max-w-4xl flex-col"
      onClose={onClose}
    >
      <div className="flex items-center gap-2">
        <h2 id="list-title" className="flex items-center gap-2 text-base">
          <Table2 className="size-4" />
          {t("場所の一覧")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("名前・色はここで直せます。「表示」でその場所へ移動します。")}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <select
          value={filter.floor}
          onChange={(e) => onFilter({ ...filter, floor: e.target.value })}
          aria-label={t("階で絞り込む")}
          className="h-8 rounded-md border border-input bg-transparent px-2"
        >
          <option value="">{t("すべての階")}</option>
          {doc.floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={filter.query}
          onChange={(e) => onFilter({ ...filter, query: e.target.value })}
          placeholder={t("名前で絞り込む")}
          aria-label={t("名前で絞り込む")}
          className="h-8 w-48 rounded-md border border-input bg-transparent px-2"
        />
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={filter.unnamed}
            onChange={(e) => onFilter({ ...filter, unnamed: e.target.checked })}
          />
          {t("名前がないものだけ")}
        </label>
        <span className="ml-auto font-mono text-muted-foreground">
          {t("{n}件", { n: rows.length })}
        </span>
      </div>
      <div className="studio-thin-scroll mt-3 min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-card text-left text-muted-foreground">
            <tr className="border-b">
              <th className="w-20 px-3 py-2 font-normal">{t("階")}</th>
              <th className="w-24 px-3 py-2 font-normal">{t("種類")}</th>
              <th className="px-3 py-2 font-normal">{t("名前")}</th>
              <th className="w-52 px-3 py-2 font-normal">{t("色")}</th>
              <th className="w-20 px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("当てはまる場所がありません")}
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr
                key={o.id}
                className="border-b last:border-b-0 hover:bg-accent/40"
              >
                <td className="px-3 py-1.5 font-mono">{floorName(o.floor)}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {kindOf(o)}
                </td>
                <td className="px-2 py-1">
                  <input
                    value={o.title ?? ""}
                    onChange={(e) => onChange(o.id, { title: e.target.value })}
                    placeholder={t("（無題）")}
                    aria-label={t("名前")}
                    className="h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-sm hover:border-[var(--studio-divider)] focus:border-[var(--studio-divider)]"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex gap-1">
                    {PALETTE_KEYS.map((k) => (
                      <ColorSwatch
                        key={k}
                        k={k}
                        selected={shownColorOf(o) === k}
                        aria-pressed={shownColorOf(o) === k}
                        onClick={() => onChange(o.id, { color: k })}
                        className="size-4 rounded"
                      />
                    ))}
                  </div>
                </td>
                <td className="px-2 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => onShow(o.id)}
                    className="h-7 rounded-md border px-2 hover:bg-accent"
                  >
                    {t("表示")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
