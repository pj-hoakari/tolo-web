"use client";

import { ArrowRight, Info, Search, TriangleAlert, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, TextField } from "@/components/ui/textfield";
import { resolveLabel } from "@/features/tenant/management/graph/utils/labels";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import type { GuestGuideMap } from "@/server/router";
import { type GuestPolling, useGuestPolling } from "../useGuestPolling";
import { type GuideMapMarker, GuideMapView } from "./GuideMapView";
import { computeFloorRoute, type FloorRouteResult } from "./guideMapFloorRoute";
import {
  clearGuideMapFloors,
  setGuideMapActiveFloor,
  setGuideMapFloors,
  useGuideMapFloor,
} from "./guideMapFloorStore";
import {
  type CrowdEntry,
  type CrowdMap,
  contentBounds,
  crowdByObject,
  isDestination,
  type MapObject,
  type PlaceObject,
} from "./guideMapLayout";
import { InfoCard } from "./InfoCard";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

/** 混雑の中身が同じかを比べるための文字列（定期取得のたびに経路を引き直さないため） */
const crowdKey = (crowd: CrowdMap) =>
  [...crowd]
    .map(([id, s]) => `${id}:${s.level}:${s.danger ? 1 : 0}`)
    .sort()
    .join("|");

/** 経路が同じかを比べるための文字列 */
const routeKey = (route: FloorRouteResult | null) =>
  route && "steps" in route ? JSON.stringify(route.steps) : null;

function GuideMap({ eventId, qrLocationId }: GuestInfoComponentProps) {
  const t = useTranslations("Guest");
  const [guideMap, setGuideMap] = useState<GuestPolling<GuestGuideMap>>({
    status: "loading",
  });
  useEffect(() => {
    let active = true;
    orpc.guest.getGuideMap({ eventId, qrLocationId }).then(
      (data) => {
        if (active) setGuideMap({ status: "ready", data });
      },
      () => {
        if (active) setGuideMap({ status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [eventId, qrLocationId]);
  if (guideMap.status !== "ready")
    return (
      <InfoCard title={t("guideMap.title")}>
        <p className="text-sm text-primary/55">
          {guideMap.status === "loading" ? t("loading") : t("loadError")}
        </p>
      </InfoCard>
    );
  return <GuideMapContent eventId={eventId} guideMap={guideMap.data} />;
}

function GuideMapContent({
  eventId,
  guideMap: { graph, layout: doc, currentPointId },
}: {
  eventId: string;
  guideMap: GuestGuideMap;
}) {
  const t = useTranslations("Guest.guideMap");
  const tCongestion = useTranslations("Guest.congestion");
  const locale = useLocale();

  const floorIndex = new Map(doc.groups.map((g, i) => [g.groupId, i]));
  const labelsByGroupId = new Map(
    graph.groups.map((g) => [g.groupId, g.labels]),
  );
  const floorNameOf = (id: string) =>
    resolveLabel(labelsByGroupId.get(id) ?? {}, locale).text;
  const labelsByPointId = new Map(
    graph.points.map((p) => [p.pointId, p.labels]),
  );

  /**
   * 現在地とみなす場所。
   * QR の設置箇所のポイントに結び付いた場所を使う。無ければ案内マップエディタで指定した既定の出発地（startId）を、それも無ければ「現在地」「入口」「入場ゲート」などの名前の場所を、
   * 無ければいちばん下の階の場所（目的地 → 階段・エレベーターの順）を、それも無ければ最初の目的地を使う。
   */
  const groundPlaces = doc.objects.filter(
    (o): o is PlaceObject =>
      o.kind === "place" && o.groupId === doc.groups[0]?.groupId,
  );
  const start: PlaceObject | undefined =
    (currentPointId
      ? doc.objects.find(
          (o): o is PlaceObject =>
            o.kind === "place" && o.pointId === currentPointId,
        )
      : undefined) ??
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
  const blankFrame =
    contentBounds(
      doc.objects.filter(
        (o) => !doc.groups.find((g) => g.groupId === o.groupId)?.image,
      ),
    ) ?? undefined;

  /** 起動時に表示するフロア（現在地のフロア） */
  const startFloor = start?.groupId ?? doc.groups[0]?.groupId;

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
      doc.groups.map((g) => ({
        id: g.groupId,
        labels: graph.groups.find((x) => x.groupId === g.groupId)?.labels ?? {},
      })),
      startFloor,
    );
    return () => clearGuideMapFloors();
  }, [doc, graph, startFloor]);
  const activeFloorId = sharedFloorId ?? startFloor;

  // 目的地検索の入力と、検索/一覧から選んだ目的地
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 表示名（グラフのポイントのラベルを表示言語で解決し、無ければレイアウトの名前を使う）
  const nameOf = (o: MapObject) => {
    const labels = o.pointId && labelsByPointId.get(o.pointId);
    return (labels && resolveLabel(labels, locale).text) || (o.title ?? "");
  };

  // 現在地そのものは目的地の候補に出さない
  const destinations = doc.objects.filter(
    (o): o is PlaceObject => isDestination(o) && o.id !== start?.id,
  );

  // 現在地→目的地の経路（階が違えば階段・エスカレーター・エレベーターを経由する）。混雑している所は避ける
  const route = useMemo(
    () =>
      selectedId && start
        ? computeFloorRoute(doc, start.id, selectedId, { crowd })
        : null,
    [doc, start, selectedId, crowd],
  );
  // 混雑を考えないときの経路（混雑を避けたかどうかの表示に使う）
  const plainRoute = useMemo(
    () =>
      selectedId && start && crowd.size > 0
        ? computeFloorRoute(doc, start.id, selectedId)
        : null,
    [doc, start, selectedId, crowd],
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
  // 現在地が階移動手段そのものだと「エレベーター → エレベーター」の歩かない区間ができるので省く
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
    setGuideMapActiveFloor(startFloor);
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
    .filter((o) => o.groupId === activeFloorId)
    .map((o) => (o.kind === "line" ? o : { ...o, title: nameOf(o) }));

  // 表示中フロアで歩く区間の経路線
  const routes = steps.flatMap((s) =>
    s.kind === "walk" && s.floor === activeFloorId ? [s.points] : [],
  );

  // 現在地・目的地・乗り換えのラベル
  const markers: GuideMapMarker[] = [];
  // 場所の名前がすでに「現在地」なら、同じ文言の目印は重ねない
  if (start && nameOf(start) !== t("currentLocation"))
    markers.push({ objectId: start.id, label: t("currentLocation") });
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
                className="h-9 gap-1.5 rounded-full border-primary/12 px-3.5 text-sm text-primary/70 hover:text-accent"
                onPress={() => pickRoom(o.id)}
              >
                {nameOf(o)}
                {doc.groups.length > 1 && (
                  <span className="text-xs text-primary/40">
                    {floorNameOf(o.groupId)}
                  </span>
                )}
              </Button>
            ))
          ) : (
            <span className="text-sm text-primary/45">{t("noResults")}</span>
          )}
        </div>
      )}

      {selected && !q && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-secondary">
            {nameOf(selected)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1 px-3 text-sm text-primary/55"
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
    <p className="mt-3 text-sm text-primary/55">{t("hint")}</p>
  ) : route && "error" in route ? (
    <p className="mt-3 text-sm text-primary/55">{t("noRoute")}</p>
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
              className="flex items-center gap-2 px-3 py-1 text-sm text-primary/55"
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

  const floor =
    doc.groups.find((g) => g.groupId === activeFloorId) ?? doc.groups[0];

  return (
    <GuideMapView
      // フロアを切り替えたら拡大を解いて全体から見せる
      key={floor.groupId}
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
      frame={floor.image ? undefined : blankFrame}
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
