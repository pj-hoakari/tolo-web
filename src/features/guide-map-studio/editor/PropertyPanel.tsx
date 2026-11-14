"use client";

// 右の設定：選んでいる物の設定（名前・色・説明・固定・形・階段・エレベーター・混雑とのつなぎ）

import { Copy, Lock, LockOpen, Trash2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ColorSwatch } from "./ColorSwatch";
import { labelOf } from "./guideMapIO";
import { useI18n } from "./i18n";
import { ConnectorIcon } from "./StudioIcons";
import {
  CONNECTOR_TYPES,
  type ConnectorDirection,
  type ConnectorObject,
  type ConnectorType,
  type CrowdState,
  DEFAULT_COLOR,
  type Floor,
  hasInfo,
  isConnector,
  MARKER_SIZE_MAX,
  MARKER_SIZE_MIN,
  type MapObject,
  markBoxOf,
  PALETTE_GROUPS,
  type PlaceObject,
  shownColorOf,
  type TextObject,
  type VenueGraph,
} from "./venueMap";

// 階移動ポイントの設定（種類・つながる階・エスカレーターの向き）。同じ link の全フロア分にまとめて効く
export function ConnectorPanel({
  connector,
  floors,
  linkedFloorIds,
  onType,
  onDirection,
  onMarkSize,
  onToggleFloor,
}: {
  connector: ConnectorObject;
  floors: Floor[];
  linkedFloorIds: string[];
  onType: (t: ConnectorType) => void;
  onDirection: (d: ConnectorDirection) => void;
  onMarkSize: (size: { markW?: number; markH?: number }) => void;
  onToggleFloor: (floorId: string, on: boolean) => void;
}) {
  const { t, connectorName } = useI18n();
  const dir = connector.direction ?? "both";
  return (
    <div className="mb-3 space-y-2.5 rounded-lg border p-2.5 text-xs">
      <div>
        <span className="text-muted-foreground">{t("種類")}</span>
        <div className="mt-1 flex gap-1">
          {CONNECTOR_TYPES.map((ct) => (
            <button
              key={ct}
              type="button"
              onClick={() => onType(ct)}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1",
                connector.connector === ct
                  ? "bg-accent text-primary"
                  : "hover:bg-accent",
              )}
            >
              <ConnectorIcon type={ct} className="size-3.5" />
              {connectorName(ct)}
            </button>
          ))}
        </div>
      </div>
      {connector.shape === "pin" && (
        <div>
          <span className="text-muted-foreground">
            {t("マークの大きさ（全部の階に反映・角のハンドルでも変更可）")}
          </span>
          <div className="mt-1 flex items-center gap-2">
            {(["markW", "markH"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1">
                <span className="text-muted-foreground">
                  {k === "markW" ? t("幅") : t("高さ")}
                </span>
                <input
                  type="number"
                  min={MARKER_SIZE_MIN}
                  max={MARKER_SIZE_MAX}
                  value={markBoxOf(connector)[k === "markW" ? "w" : "h"]}
                  onChange={(e) =>
                    onMarkSize({
                      [k]: Math.min(
                        MARKER_SIZE_MAX,
                        Math.max(
                          MARKER_SIZE_MIN,
                          Number(e.target.value) || MARKER_SIZE_MIN,
                        ),
                      ),
                    })
                  }
                  className="h-7 w-16 rounded-md border border-input bg-transparent px-1.5"
                />
              </label>
            ))}
            <span className="text-muted-foreground">px</span>
          </div>
        </div>
      )}
      <div>
        <span className="text-muted-foreground">{t("つながる階")}</span>
        {floors.length < 2 ? (
          <p className="mt-1 text-muted-foreground">
            {t("フロアタブの「＋」で階を増やすと選べます。")}
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {floors.map((f) => (
              <label key={f.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={linkedFloorIds.includes(f.id)}
                  disabled={f.id === connector.floor}
                  onChange={(e) => onToggleFloor(f.id, e.target.checked)}
                />
                {f.name}
              </label>
            ))}
          </div>
        )}
        {floors.length >= 2 && linkedFloorIds.length < 2 && (
          <p className="mt-1 text-primary">
            {t("まだ別の階とつながっていません。")}
          </p>
        )}
        <p className="mt-1 text-muted-foreground">
          {t(
            "チェックした階にも同じ位置に置かれます。位置がずれる場合は、その階で動かしてください。",
          )}
        </p>
      </div>
      {connector.connector === "escalator" && (
        <div>
          <span className="text-muted-foreground">{t("向き")}</span>
          <div className="mt-1 flex gap-1">
            {(["both", "up", "down"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDirection(d)}
                className={cn(
                  "rounded-md border px-2 py-1",
                  dir === d ? "bg-accent text-primary" : "hover:bg-accent",
                )}
              >
                {d === "both"
                  ? t("上り・下り")
                  : d === "up"
                    ? t("上りのみ")
                    : t("下りのみ")}
              </button>
            ))}
          </div>
          <p className="mt-1 text-muted-foreground">
            {t("上り＝フロアタブで右側の階へ進む向きです。")}
          </p>
        </div>
      )}
    </div>
  );
}

// part＝"basic"（名前・色・説明など、まず決めること）／"advanced"（固定・形・混雑とのつなぎ。くわしい設定の中）
type PropertyPanelProps = {
  part: "basic" | "advanced";
  object: MapObject;
  graph?: VenueGraph;
  onLoadGraph: (file: File) => void;
  onLock: (on: boolean) => void;
  onChange: (patch: Partial<MapObject>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  previewCrowd?: CrowdState;
  onPreviewCrowd: (state: CrowdState | undefined) => void;
};

export function PropertyPanel({
  part,
  object,
  graph,
  onLoadGraph,
  onLock,
  onChange,
  onDelete,
  onDuplicate,
  onPreview,
  previewCrowd,
  onPreviewCrowd,
}: PropertyPanelProps) {
  const { t } = useI18n();
  const info = object.kind !== "text" && hasInfo(object);
  if (part === "advanced")
    return (
      <div className="space-y-2.5 text-xs">
        <button
          type="button"
          onClick={() => onLock(!object.locked)}
          aria-pressed={Boolean(object.locked)}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5",
            object.locked
              ? "border-primary bg-accent text-primary"
              : "hover:bg-accent",
          )}
        >
          {object.locked ? (
            <Lock className="size-3.5" />
          ) : (
            <LockOpen className="size-3.5" />
          )}
          {object.locked
            ? t("固定中（押すと外す）")
            : t("固定する（動かないようにする）")}
        </button>
        {object.kind === "place" && !isConnector(object) && (
          <div>
            <span className="text-muted-foreground">{t("形")}</span>
            <div className="mt-1 flex gap-1">
              {(["pin", "rect", "circle"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ shape: s } as Partial<MapObject>)}
                  className={cn(
                    "rounded-md border px-2 py-1",
                    (object as PlaceObject).shape === s
                      ? "bg-accent text-primary"
                      : "hover:bg-accent",
                  )}
                >
                  {s === "pin"
                    ? t("目印")
                    : s === "rect"
                      ? t("四角い区画")
                      : t("丸い区画")}
                </button>
              ))}
            </div>
            {(object as PlaceObject).shape !== "pin" && (
              <label className="mt-2 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={Boolean((object as PlaceObject).pin)}
                  onChange={(e) =>
                    onChange({ pin: e.target.checked } as Partial<MapObject>)
                  }
                />
                <span className="text-muted-foreground">
                  {t("真ん中に目印（ピン）を表示")}
                </span>
              </label>
            )}
          </div>
        )}
        {object.kind !== "text" && (
          <GraphLinkFields
            object={object}
            graph={graph}
            onLoadGraph={onLoadGraph}
            onChange={onChange}
            previewCrowd={previewCrowd}
            onPreviewCrowd={onPreviewCrowd}
          />
        )}
      </div>
    );
  return (
    <div className="space-y-3 text-xs">
      <label className="block">
        <span className="font-medium">
          {object.kind === "text" ? t("文字") : t("名前")}
        </span>
        <input
          value={object.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
          className={cn(
            "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm",
            !object.title?.trim() && object.kind !== "text" && "border-primary",
          )}
          placeholder={
            object.kind === "text"
              ? t("表示する文字")
              : t("例：受付・101教室・売店")
          }
        />
        {!object.title?.trim() &&
          object.kind === "place" &&
          !isConnector(object) && (
            <span className="mt-1 block text-primary">
              {t("名前を入れると、地図に表示され、お客さんが目的地に選べます")}
            </span>
          )}
      </label>
      <div>
        <span className="font-medium">{t("色")}</span>
        <div className="mt-1 space-y-1.5">
          {PALETTE_GROUPS.map((group) => (
            <div key={group.label}>
              <span className="mb-0.5 block text-muted-foreground">
                {t(group.label)}
              </span>
              {/* 見出しごとに 1 行に並べる（折り返さない） */}
              <div className="flex flex-nowrap gap-1">
                {group.keys.map((k) => (
                  <ColorSwatch
                    key={k}
                    k={k}
                    selected={shownColorOf(object) === k}
                    aria-pressed={shownColorOf(object) === k}
                    onClick={() => onChange({ color: k })}
                    className="size-6"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="leading-relaxed text-muted-foreground">
        {t(
          "普通の部屋は「基本の色」から選びます。トイレなどの種類を選ぶと、tolo-web と同じ色とマークで表示されます",
        )}
      </p>
      {object.kind === "area" && (
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={Boolean(object.closed)}
            onChange={(e) =>
              onChange({ closed: e.target.checked } as Partial<MapObject>)
            }
          />
          <span>{t("通行止め（ここは避けて案内）")}</span>
        </label>
      )}
      {object.kind === "area" && (
        // tolo-web は「建物の外枠」のエリアを、床（通路）を明るく塗って縁を壁として描く。色キー building で印を付ける
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={object.color === "building"}
            onChange={(e) =>
              onChange({ color: e.target.checked ? "building" : DEFAULT_COLOR })
            }
          />
          <span>{t("建物の外枠（壁として描く）")}</span>
        </label>
      )}
      {object.kind === "text" && (
        <label className="flex items-center gap-1.5">
          <span className="font-medium">{t("文字サイズ")}</span>
          <input
            type="number"
            min={8}
            max={72}
            value={(object as TextObject).size}
            onChange={(e) =>
              onChange({
                size: Math.max(8, Number(e.target.value)),
              } as Partial<MapObject>)
            }
            className="h-8 w-16 rounded-md border border-input bg-transparent px-1.5"
          />
        </label>
      )}
      {object.kind !== "text" && (
        <>
          <label className="block">
            <span className="font-medium">{t("説明")}</span>
            <span className="ml-1 text-muted-foreground">
              {t("（任意・タップで表示）")}
            </span>
            <textarea
              value={object.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              className="mt-1 w-full resize-y rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              placeholder={t("書くとタップで情報カードに表示されます")}
            />
          </label>
          {info && (
            <button
              type="button"
              onClick={onPreview}
              className="w-full rounded-md border px-2 py-1 text-center hover:bg-accent"
            >
              {t("情報カードを表示してみる")}
            </button>
          )}
        </>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onDuplicate}
          className="flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent"
        >
          <Copy className="size-3.5" />
          {t("複製")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={object.locked}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <Trash2 className="size-3.5" />
          {t("削除")}
        </button>
      </div>
    </div>
  );
}

// --- 混雑とのつなぎ（tolo-web のグラフ） ---
// tolo-web は Guest Service の混雑状況（"pointId:<ID>" / "routeId:<ID>"）を、この ID で地図の物に重ね、混雑を避けて誘導する。
// 結び付ける候補は、タブ（マップ）ごとに読み込んだグラフ（doc.graph）から選ぶ。
// 混雑の色（お客さんの画面の凡例と同じ段階：中・高・危険）
export const crowdColor = (st: CrowdState) =>
  st.danger ? "#c2410c" : st.level === "high" ? "#e0663f" : "#e2a53a";

export const PREVIEW_CROWD_CHOICES: {
  value: string;
  label: string;
  state?: CrowdState;
}[] = [
  { value: "", label: "なし" },
  { value: "mid", label: "混雑：中", state: { level: "mid", danger: false } },
  { value: "high", label: "混雑：高", state: { level: "high", danger: false } },
  { value: "danger", label: "危険", state: { level: "high", danger: true } },
];

type GraphLinkFieldsProps = {
  object: MapObject;
  graph?: VenueGraph;
  onLoadGraph: (file: File) => void;
  onChange: (patch: Partial<MapObject>) => void;
  previewCrowd?: CrowdState;
  onPreviewCrowd: (state: CrowdState | undefined) => void;
};

function GraphLinkFields({
  object,
  graph,
  onLoadGraph,
  onChange,
  previewCrowd,
  onPreviewCrowd,
}: GraphLinkFieldsProps) {
  const { t, lang } = useI18n();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const canRoute = object.kind === "area" || object.kind === "route";
  const previewValue = !previewCrowd
    ? ""
    : previewCrowd.danger
      ? "danger"
      : previewCrowd.level;
  const groupName = (id?: string) =>
    labelOf(graph?.groups.find((g) => g.id === id)?.labels, lang);
  const point = graph?.points.find((p) => p.id === object.graphPointId);
  const route = graph?.routes.find((r) => r.id === object.graphRouteId);
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{t("混雑とのつなぎ")}</span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border px-2 py-0.5 hover:bg-accent"
        >
          {graph ? t("グラフを読み直す") : t("グラフを読み込む")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onLoadGraph(f);
          }}
        />
      </div>
      {!graph ? (
        <p className="leading-relaxed text-muted-foreground">
          {t(
            "グラフ（グラフ編集で作ったもの）を読み込むと、この場所を混雑の情報と結び付けられます。結び付けた所が混んでいると、お客さんの画面ではそこを避けて案内します。",
          )}
        </p>
      ) : (
        <>
          <label className="block">
            <span className="text-muted-foreground">
              {t("ポイント（場所）")}
            </span>
            <select
              value={object.graphPointId ?? ""}
              onChange={(e) =>
                onChange({ graphPointId: e.target.value || undefined })
              }
              className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-1.5 text-sm"
            >
              <option value="">{t("（結び付けない）")}</option>
              {graph.groups.map((g) => {
                const ps = graph.points.filter((p) => p.groupId === g.id);
                return ps.length ? (
                  <optgroup key={g.id} label={labelOf(g.labels, lang)}>
                    {ps.map((p) => (
                      <option key={p.id} value={p.id}>
                        {labelOf(p.labels, lang) || p.id}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
              {graph.points
                .filter(
                  (p) =>
                    !p.groupId || !graph.groups.some((g) => g.id === p.groupId),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {labelOf(p.labels, lang) || p.id}
                  </option>
                ))}
              {object.graphPointId && !point && (
                <option value={object.graphPointId}>
                  {t("（グラフに無い：{id}）", { id: object.graphPointId })}
                </option>
              )}
            </select>
          </label>
          {object.graphPointId && !point && (
            <p className="text-primary">
              {t("読み込んだグラフに、このポイントがありません")}
            </p>
          )}
          {point && object.kind === "place" && (
            <p className="leading-relaxed text-muted-foreground">
              {t(
                "お客さんの画面では、名前が「{name}」と表示されます（ポイントの名前）。",
                { name: labelOf(point.labels, lang) },
              )}
            </p>
          )}
          {canRoute && (
            <>
              <label className="block">
                <span className="text-muted-foreground">
                  {t("ルート（通路）")}
                </span>
                <select
                  value={object.graphRouteId ?? ""}
                  onChange={(e) =>
                    onChange({ graphRouteId: e.target.value || undefined })
                  }
                  className="mt-0.5 h-8 w-full rounded-md border border-input bg-transparent px-1.5 text-sm"
                >
                  <option value="">{t("（結び付けない）")}</option>
                  {graph.routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {labelOf(r.labels, lang) || r.id}
                      {groupName(
                        graph.points.find((p) => p.id === r.source)?.groupId,
                      )
                        ? `（${groupName(graph.points.find((p) => p.id === r.source)?.groupId)}）`
                        : ""}
                    </option>
                  ))}
                  {object.graphRouteId && !route && (
                    <option value={object.graphRouteId}>
                      {t("（グラフに無い：{id}）", { id: object.graphRouteId })}
                    </option>
                  )}
                </select>
              </label>
              {object.graphRouteId && !route && (
                <p className="text-primary">
                  {t("読み込んだグラフに、このルートがありません")}
                </p>
              )}
              <p className="leading-relaxed text-muted-foreground">
                {t(
                  "廊下などの通路は、通路に沿って範囲を描き、ルートに結び付けると、そこが混んだときに避けられます。",
                )}
              </p>
            </>
          )}
        </>
      )}
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">{t("混雑を試す")}</span>
        <select
          value={previewValue}
          onChange={(e) =>
            onPreviewCrowd(
              PREVIEW_CROWD_CHOICES.find((c) => c.value === e.target.value)
                ?.state,
            )
          }
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1"
        >
          {PREVIEW_CROWD_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {t(c.label)}
            </option>
          ))}
        </select>
      </label>
      <p className="leading-relaxed text-muted-foreground">
        {t(
          "「混雑を試す」は、ここでの誘導プレビューにだけ効きます（保存しません）。お客さんの画面では、実際の混雑状況で避けます。",
        )}
      </p>
    </div>
  );
}
