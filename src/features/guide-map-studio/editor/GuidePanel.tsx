"use client";

// 右の設定の「誘導」タブ：現在地・目的地を選び、混雑を試して、お客さんの画面と同じ道を確かめる

import { Check, RotateCcw, Route, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoutePinSelect } from "./Fields";
import { useI18n } from "./i18n";
import { crowdColor, PREVIEW_CROWD_CHOICES } from "./PropertyPanel";
import { ConnectorIcon } from "./StudioIcons";
import { GUIDE } from "./shared";
import type { RoutePreview } from "./useRoutePreview";
import type { VenueMapDoc } from "./venueMap";

// 誘導プレビュー（ピン→ピンを、壁を避けた道なりでつなぐ）。右の設定の「誘導」タブの中身
type GuidePanelProps = {
  route: RoutePreview;
  doc: VenueMapDoc;
  goFloor: (id: string) => void;
  onStart: (id: string) => void;
};

export function GuidePanel({ route, doc, goFloor, onStart }: GuidePanelProps) {
  const { t, tg, connectorName } = useI18n();
  const {
    routeGoal,
    setRouteGoal,
    previewCrowd,
    setPreviewCrowd,
    trialLevel,
    setTrialLevel,
    floorName,
    titleOf,
    previewCrowdMap,
    pins,
    toloDefaultStart,
    routeResult,
    throughDanger,
    avoided,
    routeSteps,
    routeFloors,
    crowdTargets,
    crowdTargetName,
    carRows,
    isCarKey,
    trialState,
    toggleTrials,
    setCrowdTrial,
    resetRoutePreview,
  } = route;
  const routeStart = doc.startId ?? "";
  return (
    <div className="border-t py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-mono text-[11px] font-normal tracking-[0.16em] text-muted-foreground">
          <Route className="size-4" />
          {t("混雑を避けて誘導（プレビュー）")}
        </h2>
        {(routeGoal || Object.keys(previewCrowd).length > 0) && (
          <button
            type="button"
            onClick={resetRoutePreview}
            title={t(
              "目的地・混雑の試しを、はじめの状態に戻します（出発＝現在地はそのまま）",
            )}
            className="-my-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            {t("リセット")}
          </button>
        )}
      </div>
      {pins.length < 2 ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "名前のある場所を2つ以上置くと、お客さんの画面と同じように、混雑を避けて目的地へ誘導する道を試せます。",
          )}
        </p>
      ) : (
        <div className="space-y-2 text-xs">
          <p className="leading-relaxed text-muted-foreground">
            {t(
              "お客さんの画面と同じ計算で、混んでいる所を避けて目的地へ誘導する道を出します。",
            )}
          </p>
          <RoutePinSelect
            id="route-start"
            label={tg("currentLocation")}
            value={routeStart}
            pins={pins}
            floors={doc.floors}
            onChange={(id) => {
              onStart(id);
              const p = pins.find((x) => x.id === id);
              if (p && p.floor !== doc.activeFloorId) goFloor(p.floor);
            }}
          />
          <p className="-mt-1 pl-14 leading-relaxed text-muted-foreground">
            {t(
              "お客さんの現在地は、読み取った QR コードの場所が先です。分からないときに、ここで選んだ場所が現在地になります。",
            )}
          </p>
          {!pins.some((p) => p.id === routeStart) && toloDefaultStart && (
            <p className="-mt-1 pl-14 leading-relaxed text-primary">
              {t(
                "決めていないと、お客さんの画面では「{name}」が現在地になります。",
                { name: toloDefaultStart.label },
              )}{" "}
              <button
                type="button"
                onClick={() => onStart(toloDefaultStart.id)}
                className="underline underline-offset-2"
              >
                {t("ここにする")}
              </button>
            </p>
          )}
          {/* tolo-web と同じく、現在地そのものは目的地に出さない */}
          <RoutePinSelect
            label={tg("destinationsLabel")}
            value={routeGoal}
            pins={pins.filter((p) => p.id !== routeStart)}
            floors={doc.floors}
            onChange={setRouteGoal}
          />

          {/* 混雑を試す。度合いを先に決めて、階段・EV の表のマスを押す */}
          <div className="space-y-2 rounded-md border p-2">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{t("混雑を試す")}</span>
              <span className="flex-1" />
              {/* 混ませる度合い（色の見本つき） */}
              <div
                role="radiogroup"
                aria-label={t("混雑の度合い")}
                className="flex items-center gap-0.5 rounded-md border p-0.5"
              >
                {PREVIEW_CROWD_CHOICES.flatMap((c) =>
                  c.state ? [{ ...c, color: crowdColor(c.state) }] : [],
                ).map((c) => (
                  // biome-ignore lint/a11y/useSemanticElements: 度合いを見た目のボタンで選ぶ（React Aria の ToggleButtonGroup に置き換えるまで）
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={trialLevel === c.value}
                    onClick={() => setTrialLevel(c.value)}
                    className={cn(
                      "flex items-center gap-1 rounded border px-1.5 py-0.5",
                      trialLevel === c.value
                        ? "bg-card font-semibold text-foreground shadow-sm"
                        : "border-transparent text-muted-foreground hover:bg-accent",
                    )}
                    style={
                      trialLevel === c.value
                        ? {
                            borderColor: c.color,
                            boxShadow: `inset 0 -2px 0 ${c.color}`,
                          }
                        : undefined
                    }
                  >
                    {trialLevel === c.value ? (
                      <Check className="size-3" style={{ color: c.color }} />
                    ) : (
                      <span
                        className="size-2 rounded-sm"
                        style={{ background: c.color }}
                      />
                    )}
                    {t(c.label).replace(/^混雑：/, "")}
                  </button>
                ))}
              </div>
            </div>

            <p className="flex items-center gap-1.5 leading-relaxed">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: crowdColor(trialState) }}
              />
              {t("マスを押すと「{level}」で混ませます", {
                level: t(
                  PREVIEW_CROWD_CHOICES.find((c) => c.value === trialLevel)
                    ?.label ?? "",
                ).replace(/^混雑：/, ""),
              })}
            </p>

            {/* 階段・エレベーター：1台（1か所）＝1行、階＝1列。マスを押すとその台のその階だけ混む */}
            {carRows.length > 0 && (
              <div>
                <p className="mb-1 leading-relaxed text-muted-foreground">
                  {t(
                    "階段・エレベーター：マスを押すと、その台のその階だけ混みます。名前を押すとその台の全部の階、階を押すとその階の全部の台をまとめて混ませます。",
                  )}
                </p>
                <div className="studio-thin-scroll overflow-x-auto">
                  <table className="border-separate border-spacing-0.5">
                    <thead>
                      <tr>
                        <th />
                        {doc.floors.map((f) => {
                          const keys = carRows.flatMap((r) =>
                            r.objs
                              .filter((o) => o.floor === f.id)
                              .map((o) => `object:${o.id}`),
                          );
                          return (
                            <th key={f.id} className="p-0 font-normal">
                              <button
                                type="button"
                                disabled={keys.length === 0}
                                onClick={() => toggleTrials(keys)}
                                title={`${f.name}：${t("{floor}の全部の台", { floor: f.name })}`}
                                className={cn(
                                  "block w-6 truncate rounded font-mono text-[10px] hover:bg-accent",
                                  keys.length > 0 &&
                                    keys.every((k) => previewCrowd[k]) &&
                                    "text-primary",
                                )}
                              >
                                {f.name}
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {carRows.map((r) => {
                        const keys = r.objs.map((o) => `object:${o.id}`);
                        return (
                          <tr key={r.link}>
                            <th className="p-0 text-left font-normal">
                              <button
                                type="button"
                                onClick={() => toggleTrials(keys)}
                                title={t("{name}の全部の階", { name: r.label })}
                                className={cn(
                                  "flex items-center gap-1 rounded px-1 py-0.5 whitespace-nowrap hover:bg-accent",
                                  keys.every((k) => previewCrowd[k]) &&
                                    "text-primary",
                                )}
                              >
                                <ConnectorIcon
                                  type={r.ct}
                                  className="size-3.5 shrink-0"
                                />
                                {r.label}
                              </button>
                            </th>
                            {doc.floors.map((f) => {
                              const o = r.objs.find((x) => x.floor === f.id);
                              if (!o)
                                return (
                                  <td
                                    key={f.id}
                                    className="text-center text-muted-foreground"
                                  >
                                    –
                                  </td>
                                );
                              const st = previewCrowd[`object:${o.id}`];
                              return (
                                <td key={f.id} className="p-0 text-center">
                                  <button
                                    type="button"
                                    aria-pressed={Boolean(st)}
                                    aria-label={t("{name}（{floor}）", {
                                      name: r.label,
                                      floor: f.name,
                                    })}
                                    title={t("{name}（{floor}）", {
                                      name: r.label,
                                      floor: f.name,
                                    })}
                                    onClick={() =>
                                      toggleTrials([`object:${o.id}`])
                                    }
                                    className="size-5 rounded border hover:border-primary"
                                    style={
                                      st
                                        ? {
                                            background: crowdColor(st),
                                            borderColor: crowdColor(st),
                                          }
                                        : undefined
                                    }
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ほかの場所（部屋・廊下など。右の設定から混ませたもの）：外せるように並べる */}
            {Object.entries(previewCrowd)
              .filter(([k]) => !isCarKey(k))
              .map(([k, st]) => {
                const linked = crowdTargets(k);
                return (
                  <div key={k} className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: crowdColor(st) }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {crowdTargetName(k)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {st.danger
                        ? t("危険")
                        : st.level === "high"
                          ? t("混雑：高")
                          : t("混雑：中")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCrowdTrial(k, undefined)}
                      aria-label={t("外す")}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                    {linked.length === 0 && (
                      <span className="basis-full pl-4 text-primary">
                        {t(
                          "地図のどれとも結び付いていないので、道には影響しません",
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            {Object.keys(previewCrowd).length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewCrowd({})}
                  className="h-7 shrink-0 rounded-md border px-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {t("すべて外す")}
                </button>
              </div>
            )}
          </div>

          {routeResult && "error" in routeResult && (
            <p className="rounded-md border border-dashed p-2 text-muted-foreground">
              {routeResult.error === "no-connector"
                ? t(
                    "{floor}から別の階へ移れる{what}がありません。道具の「階段・EV」で置き、つながる階を選んでください。",
                    {
                      floor: floorName(
                        pins.find((p) => p.id === routeStart)?.floor ?? "",
                      ),
                      what: t("階段・エスカレーター・エレベーター"),
                    },
                  )
                : t(
                    "経路が見つかりません。通路がふさがっているか、エスカレーターの向きが合っていない可能性があります。",
                  )}
            </p>
          )}
          {/* お客さんの画面と同じお知らせ */}
          {routeSteps && previewCrowdMap.size > 0 && (
            <p
              role="status"
              className={cn(
                "flex items-start gap-1.5 rounded-md px-2 py-1.5 leading-relaxed",
                throughDanger ? "bg-primary/10 text-primary" : "bg-accent",
              )}
            >
              {throughDanger
                ? t(
                    "危険な所を通らないと行けないため、その道を案内しています。",
                  )
                : avoided
                  ? t(
                      "混雑を避けた道に変えて案内しています。灰色の点線は、混雑が無いときの道です。",
                    )
                  : t(
                      "混んでいる所を通らない道なので、そのまま案内しています。",
                    )}
            </p>
          )}
          {routeSteps && (
            <ol className="space-y-1">
              {routeSteps.map((st, i) =>
                st.kind === "walk" ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 道の手順は順番そのものが意味で、並べ替えない
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => goFloor(st.floor)}
                      className={cn(
                        "w-full rounded-md border px-2 py-1.5 text-left",
                        st.floor === doc.activeFloorId
                          ? "border-primary bg-accent"
                          : "hover:bg-accent",
                      )}
                    >
                      <span className="mr-1 text-muted-foreground">
                        {i + 1}.
                      </span>
                      {doc.floors.length > 1 && (
                        <b className="mr-1">{floorName(st.floor)}</b>
                      )}
                      {titleOf(st.fromId)} → {titleOf(st.toId)}
                    </button>
                  </li>
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 道の手順は順番そのものが意味で、並べ替えない
                  <li key={i} className="flex items-center gap-1.5 px-2 py-1">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <ConnectorIcon
                      type={st.via}
                      className="size-3.5"
                      style={{ color: GUIDE }}
                    />
                    {/* お客さんの画面の道順と同じ言い方（例：エレベーターで 1F → 3F） */}
                    <span>
                      {tg("rideStep", {
                        via: connectorName(st.via),
                        from: floorName(st.fromFloor),
                        to: floorName(st.toFloor),
                      })}
                    </span>
                  </li>
                ),
              )}
            </ol>
          )}
          {routeSteps && routeFloors.size > 1 && (
            <p className="text-muted-foreground">
              {t(
                "手順を押すとその階を表示します。地図上の「〜へ」の目印からも移れます。",
              )}
            </p>
          )}
          <p className="text-muted-foreground">
            {t("範囲を「通行止め」にすると、その道は避けて再計算します。")}
          </p>
        </div>
      )}
    </div>
  );
}
