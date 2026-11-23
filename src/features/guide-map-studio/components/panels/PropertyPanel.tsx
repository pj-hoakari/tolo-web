"use client";

// 右の設定：選んでいる物の設定（名前・大きさ・色・説明・固定・形・階段・エレベーター）

import { ChevronRight, Copy, Lock, LockOpen, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { useI18n } from "../../i18n/i18n";
import type {
  ConnectorDirection,
  ConnectorObject,
  ConnectorType,
  CrowdState,
  Floor,
  MapObject,
  PlaceObject,
  TextObject,
} from "../../type";
import { GRID_SNAP } from "../../utils/editing";
import {
  bboxOf,
  CONNECTOR_TYPES,
  DEFAULT_COLOR,
  hasInfo,
  isConnector,
  MARKER_SIZE_MAX,
  MARKER_SIZE_MIN,
  markBoxOf,
  PALETTE_GROUPS,
  shownColorOf,
} from "../../utils/guideMapDoc";
import { ColorSwatch } from "../parts/ColorSwatch";
import { ScaleSlider } from "../parts/ScaleSlider";
import { SizeSlider } from "../parts/SizeSlider";
import { ConnectorIcon, hasMarkScale } from "../parts/StudioIcons";

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
        <div className="mt-1 flex flex-wrap gap-1">
          {CONNECTOR_TYPES.map((ct) => (
            <button
              key={ct}
              type="button"
              onClick={() => onType(ct)}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1 whitespace-nowrap",
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
          <div className="mt-1.5 space-y-2.5">
            {(["markW", "markH"] as const).map((k) => (
              <SizeSlider
                key={k}
                label={k === "markW" ? t("幅") : t("高さ")}
                value={markBoxOf(connector)[k === "markW" ? "w" : "h"]}
                min={MARKER_SIZE_MIN}
                max={MARKER_SIZE_MAX}
                onChange={(v) => onMarkSize({ [k]: v })}
              />
            ))}
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

// part＝"basic"（名前・色・説明など、まず決めること）／"advanced"（固定・形。くわしい設定の中）
// グラフ（混雑の情報）との結び付けは、上の「その他」→「つなぎ」でまとめて行う
type PropertyPanelProps = {
  part: "basic" | "advanced";
  object: MapObject;
  onLock: (on: boolean) => void;
  onChange: (patch: Partial<MapObject>) => void;
  /** 大きさ（幅・高さ）を変える。部屋・区画は真ん中ではなく左上を固定、範囲は形ごと伸び縮みする */
  onResize?: (size: { w?: number; h?: number }) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
};

export function PropertyPanel({
  part,
  object,
  onLock,
  onChange,
  onResize,
  onDelete,
  onDuplicate,
  onPreview,
}: PropertyPanelProps) {
  const { t } = useI18n();
  const info = object.kind !== "text" && hasInfo(object);
  // 種類の色（トイレ・飲食など）を開いている物。選び直したら閉じる。いま種類の色の物は、初めから開いておく
  const [kindsOpenFor, setKindsOpenFor] = React.useState<string | null>(null);
  const kindsOpen =
    kindsOpenFor === object.id ||
    !(PALETTE_GROUPS[0].keys as readonly string[]).includes(
      shownColorOf(object),
    );
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
      </div>
    );
  // 範囲の用途。建物の外枠（壁として描く）か、区域（屋外・広場・待機列など。選んだ色で塗る）か。
  // tolo-web へは色の項目で伝える（建物の外枠は色キー building）
  const isBuildingArea = object.kind === "area" && object.color === "building";
  return (
    <div className="space-y-3 text-xs">
      {object.kind === "area" && (
        <div>
          <span className="font-medium">{t("用途")}</span>
          <ToggleButtonGroup
            aria-label={t("用途")}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[isBuildingArea ? "building" : "zone"]}
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (next === "building" && !isBuildingArea)
                onChange({ color: "building" });
              if (next === "zone" && isBuildingArea)
                onChange({ color: DEFAULT_COLOR });
            }}
            className="mt-1 w-full gap-1 rounded-md bg-muted p-1"
          >
            <Toggle
              id="building"
              className="selected:bg-background selected:text-foreground selected:shadow-sm h-auto flex-1 rounded-sm px-2 py-1 text-xs font-medium"
            >
              {t("建物（外枠）")}
            </Toggle>
            <Toggle
              id="zone"
              className="selected:bg-background selected:text-foreground selected:shadow-sm h-auto flex-1 rounded-sm px-2 py-1 text-xs font-medium"
            >
              {t("区域")}
            </Toggle>
          </ToggleButtonGroup>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            {isBuildingArea
              ? t(
                  "建物の外枠は、中を通路の床の色で塗り、縁を壁として太く描きます（色は選べません）。",
                )
              : t(
                  "区域は、芝生広場・待機列・屋外の会場など。選んだ色の線と薄い塗りで描きます。",
                )}
          </p>
        </div>
      )}
      {/* 名前と、名前の大きさ。範囲には名前を付けない（地図にも出さない） */}
      {object.kind !== "area" && (
        <>
          <label className="block">
            <span className="font-medium">
              {object.kind === "text" ? t("文字") : t("名前")}
            </span>
            <input
              value={object.title ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
              className={cn(
                "mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm",
                !object.title?.trim() &&
                  object.kind !== "text" &&
                  "border-primary",
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
                  {t(
                    "名前を入れると、地図に表示され、お客さんが目的地に選べます",
                  )}
                </span>
              )}
          </label>
          {/* 名前（文字）の大きさ。部屋などは、部屋の大きさに合わせた大きさ（100%）からの倍率。文字は文字サイズそのもの */}
          {object.kind === "text" ? (
            <SizeSlider
              label={t("文字サイズ")}
              value={(object as TextObject).size}
              min={8}
              max={72}
              onChange={(size) => onChange({ size } as Partial<MapObject>)}
            />
          ) : (
            <ScaleSlider
              label={t("名前の大きさ")}
              value={object.labelScale}
              max={200}
              snaps={[100, 150]}
              defaultLabel={t("自動（100%）")}
              onChange={(labelScale) => onChange({ labelScale })}
            />
          )}
        </>
      )}
      {/* マークの大きさ：目印（ピン）・部屋の中の目印・トイレなどの印・四角／丸の階段やエレベーターの印。
          ピンの階段・エレベーターは、上の「マークの大きさ」で幅と高さを変える */}
      {hasMarkScale(object) && (
        <ScaleSlider
          label={t("マークの大きさ")}
          value={object.markScale}
          max={250}
          snaps={[100, 150, 200]}
          defaultLabel={t("ふつう（100%）")}
          onChange={(markScale) => onChange({ markScale })}
        />
      )}
      {/* 大きさ：部屋・区画（四角・丸）と範囲。角のハンドルでも変えられる */}
      {(() => {
        const size =
          object.kind === "place" && object.shape !== "pin"
            ? { w: object.w, h: object.h }
            : object.kind === "area"
              ? bboxOf(object.points)
              : null;
        if (!size || !onResize) return null;
        return (
          <div className="space-y-2.5">
            <span className="font-medium">{t("大きさ")}</span>
            {(["w", "h"] as const).map((k) => (
              <SizeSlider
                key={k}
                label={k === "w" ? t("幅") : t("高さ")}
                value={Math.round(size[k])}
                min={GRID_SNAP}
                max={Math.max(1500, Math.round(size[k]))}
                typedMax={5000}
                disabled={object.locked}
                onChange={(v) => onResize({ [k]: v })}
              />
            ))}
          </div>
        );
      })()}
      {/* 色：初めは「基本の色」だけ。トイレ・飲食などの種類の色は「種類を選ぶ」で開く（いま種類の色なら開いておく） */}
      {!isBuildingArea && (
        <>
          <div>
            <span className="font-medium">{t("色")}</span>
            <div className="mt-1 space-y-1.5">
              {(kindsOpen ? PALETTE_GROUPS : PALETTE_GROUPS.slice(0, 1)).map(
                (group) => (
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
                ),
              )}
            </div>
            {!kindsOpen && (
              <Button
                variant="link"
                onPress={() => setKindsOpenFor(object.id)}
                className="mt-1.5 h-auto gap-0.5 p-0 text-xs"
              >
                <ChevronRight className="size-3.5" />
                {t("種類を選ぶ（トイレ・飲食など）")}
              </Button>
            )}
          </div>
          {kindsOpen && (
            <p className="leading-relaxed text-muted-foreground">
              {t(
                "普通の部屋は「基本の色」から選びます。トイレなどの種類を選ぶと、tolo-web と同じ色とマークで表示されます",
              )}
            </p>
          )}
        </>
      )}
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

// --- 混雑の色（誘導の「混雑を試す」で使う。お客さんの画面の凡例と同じ段階：中・高・危険） ---
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
