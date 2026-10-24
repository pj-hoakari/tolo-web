"use client";

import { ArrowRight, Info, Search, TriangleAlert, X } from "lucide-react";
import type { Messages } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, TextField } from "@/components/ui/textfield";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useGuestPolling } from "../useGuestPolling";
import { type GuideMapMarker, GuideMapView } from "./GuideMapView";
import {
  clearGuideMapFloors,
  setGuideMapActiveFloor,
  setGuideMapFloors,
  useGuideMapFloor,
} from "./guideMapFloorStore";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";
import { computeFloorRoute, type FloorRouteResult } from "./venueFloorRoute";
import venueMapData from "./venueMapData.json";
import {
  type CrowdEntry,
  type CrowdMap,
  contentBounds,
  crowdByObject,
  isDestination,
  type MapObject,
  type PlaceObject,
  type VenueMapDoc,
} from "./venueMapDoc";

/** マップ JSON の id を Guest.guideMap.destinations のキーとして扱うための型 */
type DestinationKey =
  `destinations.${keyof Messages["Guest"]["guideMap"]["destinations"] & string}`;

/** guide-map-poc の会場マップ・スタジオで「書き出す」した JSON */
const doc = venueMapData as unknown as VenueMapDoc;

const floorIndex = new Map(doc.floors.map((f, i) => [f.id, i]));
const floorNameOf = (id: string) =>
  doc.floors.find((f) => f.id === id)?.name ?? "";

/**
 * 現在地とみなす場所。
 * 作成ツールで指定した現在地（startId）を使う。指定が無ければ「現在地」「入口」「入場ゲート」などの名前の場所を、
 * 無ければいちばん下の階の場所（目的地 → 階段・エレベーターの順）を、それも無ければ最初の目的地を使う。
 * TODO: QR / API から現在地（場所 ID）を受け取る。
 */
const groundPlaces = doc.objects.filter(
  (o): o is PlaceObject => o.kind === "place" && o.floor === doc.floors[0]?.id,
);
const START: PlaceObject | undefined =
  doc.objects.find(
    (o): o is PlaceObject => o.kind === "place" && o.id === doc.startId,
  ) ??
  doc.objects
    .filter(isDestination)
    .find((o) =>
      /現在地|入口|入場|ゲート|entrance|gate/i.test(o.title ?? ""),
    ) ??
  groundPlaces.find(isDestination) ??
  groundPlaces[0] ??
  doc.objects.filter(isDestination)[0];

/**
 * 下敷き画像の無いフロアで地図として見せる範囲。
 * 白紙の広さは仮の値なので中身の範囲だけを切り出す。階を切り替えても位置がずれないよう、
 * 画像の無い全フロアの中身を合わせた範囲にする。
 */
const BLANK_FRAME =
  contentBounds(
    doc.objects.filter((o) => !doc.floors.find((f) => f.id === o.floor)?.image),
  ) ?? undefined;

/** 起動時に表示するフロア（現在地のフロア） */
const START_FLOOR = START?.floor ?? doc.activeFloorId ?? doc.floors[0]?.id;

/** 混雑の中身が同じかを比べるための文字列（定期取得のたびに経路を引き直さないため） */
const crowdKey = (crowd: CrowdMap) =>
  [...crowd]
    .map(([id, s]) => `${id}:${s.level}:${s.danger ? 1 : 0}`)
    .sort()
    .join("|");

/** 経路が同じかを比べるための文字列 */
const routeKey = (route: FloorRouteResult | null) =>
  route && "steps" in route ? JSON.stringify(route.steps) : null;

function GuideMap({ eventId }: GuestInfoComponentProps) {
  // TODO: tenantId / eventId で会場マップを API から取得する。
  //       いまはリポジトリ同梱の venueMapData.json を描画している。
  const t = useTranslations("Guest.guideMap");
  const tCongestion = useTranslations("Guest.congestion");
  const locale = useLocale();

  // 混雑状況（混雑状況カードと同じ Guest Service の GetCrowd）。グラフ ID で地図のオブジェクトに引き直す
  const crowdPolling = useGuestPolling(
    useCallback(
      () => orpc.guest.getCrowd({ eventId, language: locale }),
      [eventId, locale],
    ),
  );
  const crowdEntries: CrowdEntry[] =
    crowdPolling.status === "ready" ? crowdPolling.data.crowd : [];
  const liveCrowd = crowdByObject(doc.objects, crowdEntries);
  const liveCrowdKey = crowdKey(liveCrowd);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 中身（liveCrowdKey）が変わったときだけ作り直す
  const crowd = useMemo(() => liveCrowd, [liveCrowdKey]);

  // 現在のフロア（別カード）と表示フロアを共有する
  const { activeFloorId: sharedFloorId } = useGuideMapFloor();
  useEffect(() => {
    setGuideMapFloors(
      doc.floors.map((f) => ({ id: f.id, name: f.name })),
      START_FLOOR,
    );
    return () => clearGuideMapFloors();
  }, []);
  const activeFloorId = sharedFloorId ?? START_FLOOR;

  // 目的地検索の入力と、検索/一覧から選んだ目的地
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 表示名（i18n に定義があれば優先。JSON 側の id は任意の文字列なので、定義があるときだけ上書きする）
  const nameOf = (o: MapObject) => {
    const key = `destinations.${o.id}` as DestinationKey;
    return t.has(key) ? t(key) : (o.title ?? "");
  };

  // 現在地そのものは目的地の候補に出さない
  const destinations = doc.objects.filter(
    (o): o is PlaceObject => isDestination(o) && o.id !== START?.id,
  );

  // 現在地→目的地の経路（階が違えば階段・エスカレーター・エレベーターを経由する）。混雑している所は避ける
  const route = useMemo(
    () =>
      selectedId && START
        ? computeFloorRoute(doc, START.id, selectedId, { crowd })
        : null,
    [selectedId, crowd],
  );
  // 混雑を考えないときの経路（混雑を避けたかどうかの表示に使う）
  const plainRoute = useMemo(
    () =>
      selectedId && START && crowd.size > 0
        ? computeFloorRoute(doc, START.id, selectedId)
        : null,
    [selectedId, crowd],
  );
  const throughDanger = Boolean(
    route && "steps" in route && route.throughDanger,
  );
  const avoided =
    !throughDanger &&
    plainRoute !== null &&
    routeKey(route) !== null &&
    routeKey(route) !== routeKey(plainRoute);

  // 同じ目的地のまま、混雑状況が変わって経路が変わったら知らせる
  const currentRouteKey = routeKey(route);
  const lastRoute = useRef<{ id: string | null; key: string | null }>({
    id: null,
    key: null,
  });
  const [rerouted, setRerouted] = useState(false);
  useEffect(() => {
    const last = lastRoute.current;
    if (selectedId && last.id === selectedId && last.key !== currentRouteKey)
      setRerouted(true);
    else if (last.id !== selectedId) setRerouted(false);
    lastRoute.current = { id: selectedId, key: currentRouteKey };
  }, [selectedId, currentRouteKey]);
  // 現在地が階移動ポイントそのものだと「エレベーター → エレベーター」の歩かない区間ができるので省く
  const steps = (route && "steps" in route ? route.steps : []).filter(
    (s) => !(s.kind === "walk" && s.fromId === s.toId),
  );

  // 検索一致する目的地（名称の部分一致・大文字小文字を無視）
  const q = query.trim().toLowerCase();
  const matches = q
    ? destinations.filter((o) => nameOf(o).toLowerCase().includes(q))
    : [];

  const pickRoom = (id: string) => {
    setSelectedId(id);
    setQuery("");
    // 経路は現在地から始まるので、現在地のフロアを表示する
    setGuideMapActiveFloor(START_FLOOR);
  };
  const resetRoute = () => {
    setSelectedId(null);
    setQuery("");
  };
  // Enter で、候補があれば先頭を選ぶ（クリックと同じ挙動）
  const submitSearch = () => {
    if (matches.length > 0) pickRoom(matches[0].id);
  };

  const selected = destinations.find((o) => o.id === selectedId);
  const objectName = (id: string) => {
    const o = doc.objects.find((x) => x.id === id);
    return o ? nameOf(o) : "";
  };

  // 表示中フロアのオブジェクト（名前は表示名に解決しておく）
  const floorObjects = doc.objects
    .filter((o) => o.floor === activeFloorId)
    .map((o) => (o.kind === "route" ? o : { ...o, title: nameOf(o) }));

  // 表示中フロアで歩く区間の誘導線
  const routes = steps.flatMap((s) =>
    s.kind === "walk" && s.floor === activeFloorId ? [s.points] : [],
  );

  // 現在地・目的地・乗り換えのラベル
  const markers: GuideMapMarker[] = [];
  // 場所の名前がすでに「現在地」なら、同じ文言の目印は重ねない
  if (START && nameOf(START) !== t("currentLocation"))
    markers.push({ objectId: START.id, label: t("currentLocation") });
  for (const s of steps) {
    if (s.kind !== "ride") continue;
    const up =
      (floorIndex.get(s.toFloor) ?? 0) > (floorIndex.get(s.fromFloor) ?? 0);
    const via = t(`connectors.${s.via}`);
    markers.push({
      objectId: s.fromId,
      label: `${up ? "▲" : "▼"} ${t("rideTo", { via, floor: floorNameOf(s.toFloor) })}`,
    });
    markers.push({
      objectId: s.toId,
      label: t("arriveFrom", { floor: floorNameOf(s.fromFloor) }),
    });
  }
  if (selected) markers.push({ objectId: selected.id, label: t("goal") });

  const toolbar = (
    <div className="mb-3 space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary/40" />
        <TextField
          aria-label={t("search")}
          value={query}
          onChange={setQuery}
          className="w-full"
        >
          <Input
            placeholder={t("search")}
            className="h-11 pl-9 text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch();
              }
            }}
          />
        </TextField>
      </div>

      {q && (
        <div className="flex flex-wrap gap-1.5">
          {matches.length > 0 ? (
            matches.slice(0, 8).map((o) => (
              <Button
                key={o.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-full border-primary/12 px-3.5 text-primary/70 text-sm hover:text-accent"
                onPress={() => pickRoom(o.id)}
              >
                {nameOf(o)}
                {doc.floors.length > 1 && (
                  <span className="text-primary/40 text-xs">
                    {floorNameOf(o.floor)}
                  </span>
                )}
              </Button>
            ))
          ) : (
            <span className="text-primary/45 text-sm">{t("noResults")}</span>
          )}
        </div>
      )}

      {selected && !q && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent px-3 py-1 font-medium text-secondary text-sm">
            {nameOf(selected)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1 px-3 text-primary/55 text-sm"
            onPress={resetRoute}
          >
            <X className="size-3.5" />
            {t("reset")}
          </Button>
        </div>
      )}
    </div>
  );

  // 道順（歩く区間はタップでそのフロアを表示）
  const crowdNotice = throughDanger
    ? t("crowdThroughDanger")
    : rerouted
      ? t("crowdRerouted")
      : avoided
        ? t("crowdAvoided")
        : null;
  const footer = !selected ? (
    <p className="mt-3 text-primary/55 text-sm">{t("hint")}</p>
  ) : route && "error" in route ? (
    <p className="mt-3 text-primary/55 text-sm">{t("noRoute")}</p>
  ) : (
    <>
      {crowdNotice && (
        <p
          role="status"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
            throughDanger
              ? "bg-guest-notify/10 text-guest-notify"
              : "bg-accent/10 text-primary/75",
          )}
        >
          {throughDanger ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0" />
          )}
          {crowdNotice}
        </p>
      )}
      <ol className="mt-3 space-y-1.5">
        {steps.map((s) =>
          s.kind === "walk" ? (
            <li key={`${s.fromId}-${s.toId}`}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onPress={() => setGuideMapActiveFloor(s.floor)}
                className={cn(
                  "h-auto min-h-10 w-full justify-start gap-2 rounded-lg px-3 py-2 text-left text-sm",
                  s.floor === activeFloorId
                    ? "bg-accent/10 text-primary"
                    : "text-primary/60",
                )}
              >
                {t("walkStep", {
                  floor: floorNameOf(s.floor),
                  from: objectName(s.fromId),
                  to: objectName(s.toId),
                })}
              </Button>
            </li>
          ) : (
            <li
              key={`${s.fromId}-${s.toId}`}
              className="flex items-center gap-2 px-3 py-1 text-primary/55 text-sm"
            >
              <ArrowRight className="size-4 shrink-0" />
              {t("rideStep", {
                via: t(`connectors.${s.via}`),
                from: floorNameOf(s.fromFloor),
                to: floorNameOf(s.toFloor),
              })}
            </li>
          ),
        )}
      </ol>
    </>
  );

  const floor = doc.floors.find((f) => f.id === activeFloorId) ?? doc.floors[0];

  return (
    <GuideMapView
      // フロアを切り替えたら拡大を解いて全体から見せる
      key={floor.id}
      title={t("title")}
      floor={floor}
      objects={floorObjects}
      routes={routes}
      markers={markers}
      activeId={selectedId}
      highlightIds={q ? matches.map((o) => o.id) : undefined}
      toolbar={toolbar}
      footer={footer}
      zoomInLabel={t("expand")}
      zoomOutLabel={t("collapse")}
      zoomInHint={t("zoomInHint")}
      zoomOutHint={t("zoomOutHint")}
      closedLabel={t("closed")}
      frame={floor.image ? undefined : BLANK_FRAME}
      crowd={crowd}
      crowdLegend={{
        title: t("crowdLegend"),
        mid: tCongestion("levels.mid"),
        high: tCongestion("levels.high"),
        danger: tCongestion("danger"),
      }}
    />
  );
}

export default defineGuestInfoComponent("guide-map", GuideMap);
