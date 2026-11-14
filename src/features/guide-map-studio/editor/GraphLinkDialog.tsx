"use client";

// つなぎ：tolo-web のグラフ（階＝グループ・ポイント・ルート）と、地図の階・物を結び付ける。
// 結び付けると、お客さんの画面でその場所の混雑を受け取って避けられる

import { Link2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelOf } from "./guideMapIO";
import { useI18n } from "./i18n";
import { Modal } from "./Modal";
import type { MapObject, VenueMapDoc } from "./venueMap";

export type LinkTab = "floors" | "points" | "routes";

type GraphLinkDialogProps = {
  doc: VenueMapDoc;
  selected: MapObject | null;
  floorName: (id: string) => string;
  tab: LinkTab;
  onTab: (tab: LinkTab) => void;
  unlinkedOnly: boolean;
  onUnlinkedOnly: (on: boolean) => void;
  onLoadGraph: (file: File) => void;
  onFloorGroup: (floorId: string, groupId: string) => void;
  onChange: (id: string, patch: Partial<MapObject>) => void;
  onShow: (id: string) => void;
  onClose: () => void;
};

export function GraphLinkDialog({
  doc,
  selected,
  floorName,
  tab,
  onTab,
  unlinkedOnly,
  onUnlinkedOnly,
  onLoadGraph,
  onFloorGroup,
  onChange,
  onShow,
  onClose,
}: GraphLinkDialogProps) {
  const { t, lang } = useI18n();
  const g = doc.graph;
  const sel =
    selected &&
    (selected.kind === "place" ||
      selected.kind === "area" ||
      selected.kind === "route")
      ? selected
      : null;
  const objName = (o: MapObject) =>
    `${o.title || t("（無題）")}（${floorName(o.floor)}）`;
  const linkedTo = (key: "graphPointId" | "graphRouteId", id: string) =>
    doc.objects.filter((o) => o[key] === id);
  const rows = !g
    ? []
    : tab === "points"
      ? g.points
          .filter((p) => p.nodeType !== "EXTERNAL")
          .map((p) => ({
            id: p.id,
            name: labelOf(p.labels, lang) || p.id,
            sub: labelOf(
              g.groups.find((x) => x.id === p.groupId)?.labels,
              lang,
            ),
            linked: linkedTo("graphPointId", p.id),
            key: "graphPointId" as const,
          }))
      : tab === "routes"
        ? g.routes.map((r) => ({
            id: r.id,
            name: labelOf(r.labels, lang) || r.id,
            sub: labelOf(
              g.groups.find(
                (x) =>
                  x.id === g.points.find((p) => p.id === r.source)?.groupId,
              )?.labels,
              lang,
            ),
            linked: linkedTo("graphRouteId", r.id),
            key: "graphRouteId" as const,
          }))
        : [];
  const shown = rows.filter((r) => !unlinkedOnly || r.linked.length === 0);
  const canLink = (key: "graphPointId" | "graphRouteId") =>
    Boolean(sel && (key === "graphPointId" || sel.kind !== "place"));
  return (
    <Modal
      labelledBy="link-title"
      className="flex h-[85vh] w-full max-w-4xl flex-col"
      onClose={onClose}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="link-title" className="flex items-center gap-2 text-base">
          <Link2 className="size-4" />
          {t("混雑とのつなぎ")}
        </h2>
        <span className="flex-1" />
        {g && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {t("グループ {g}・ポイント {p}・ルート {r}", {
              g: g.groups.length,
              p: g.points.length,
              r: g.routes.length,
            })}
          </span>
        )}
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs hover:bg-accent">
          <Upload className="size-3.5" />
          {g ? t("グラフを読み直す") : t("グラフを読み込む")}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onLoadGraph(f);
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t(
          "お客さんの画面は、混雑の情報をグラフのポイント・ルートごとに受け取り、結び付いた地図の場所・範囲を避けて案内します。地図の物を選んでからここを開くと、その物に結び付けられます。",
        )}
      </p>
      {!g ? (
        <p className="mt-6 text-sm">
          {t(
            "まだグラフがありません。グラフ編集で作ったグラフ（.json）を読み込んでください。",
          )}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {(["floors", "points", "routes"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onTab(k)}
                aria-pressed={tab === k}
                className={cn(
                  "rounded-md border px-2.5 py-1",
                  tab === k
                    ? "border-primary bg-accent text-primary"
                    : "hover:bg-accent",
                )}
              >
                {k === "floors"
                  ? t("階（グループ）")
                  : k === "points"
                    ? t("ポイント（場所）")
                    : t("ルート（通路）")}
              </button>
            ))}
            {tab !== "floors" && (
              <label className="ml-2 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={unlinkedOnly}
                  onChange={(e) => onUnlinkedOnly(e.target.checked)}
                />
                {t("結び付いていないものだけ")}
              </label>
            )}
            <span className="ml-auto text-muted-foreground">
              {sel
                ? t("選んでいる物：{name}", { name: objName(sel) })
                : t("地図の物を選んでいません")}
            </span>
          </div>
          <div className="studio-thin-scroll mt-3 min-h-0 flex-1 overflow-auto rounded-md border">
            {tab === "floors" ? (
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {doc.floors.map((f) => (
                    <tr key={f.id} className="border-b last:border-b-0">
                      <td className="w-40 px-3 py-2 font-mono">{f.name}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={f.groupId ?? ""}
                          onChange={(e) => onFloorGroup(f.id, e.target.value)}
                          className="h-8 w-64 rounded-md border border-input bg-transparent px-1.5"
                        >
                          <option value="">{t("（結び付けない）")}</option>
                          {g.groups.map((x) => (
                            <option key={x.id} value={x.id}>
                              {labelOf(x.labels, lang) || x.id}
                            </option>
                          ))}
                        </select>
                        {!f.groupId && (
                          <span className="ml-2 text-primary">
                            {t("未設定")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-card text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-normal">
                      {tab === "points" ? t("ポイント") : t("ルート")}
                    </th>
                    <th className="w-24 px-3 py-2 font-normal">{t("階")}</th>
                    <th className="px-3 py-2 font-normal">
                      {t("結び付いている地図の物")}
                    </th>
                    <th className="w-44 px-3 py-2 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-muted-foreground"
                      >
                        {t("当てはまるものがありません")}
                      </td>
                    </tr>
                  )}
                  {shown.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b align-top last:border-b-0 hover:bg-accent/40"
                    >
                      <td className="px-3 py-2">
                        <span className="block">{r.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {r.id}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.sub}
                      </td>
                      <td className="px-3 py-1.5">
                        {r.linked.length === 0 ? (
                          <span className="text-primary">
                            {t("なし（ここが混んでも避けられません）")}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.linked.map((o) => (
                              <span
                                key={o.id}
                                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5"
                              >
                                {/* 地図の物の名前を押したら、その場所へ移る */}
                                <button
                                  type="button"
                                  onClick={() => onShow(o.id)}
                                  className="hover:underline"
                                >
                                  {objName(o)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onChange(o.id, {
                                      [r.key]: undefined,
                                    } as Partial<MapObject>)
                                  }
                                  aria-label={t("結び付きを外す")}
                                  title={t("結び付きを外す")}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          disabled={!canLink(r.key) || sel?.[r.key] === r.id}
                          onClick={() =>
                            sel &&
                            onChange(sel.id, {
                              [r.key]: r.id,
                            } as Partial<MapObject>)
                          }
                          title={
                            !sel
                              ? t("先に地図の物を選んでください")
                              : !canLink(r.key)
                                ? t("ルートは範囲か線に結び付けます")
                                : undefined
                          }
                          className="h-7 rounded-md border px-2 hover:bg-accent disabled:opacity-40"
                        >
                          {t("選んでいる物に結び付ける")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
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
