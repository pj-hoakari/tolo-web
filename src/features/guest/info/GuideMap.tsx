"use client";

import {
  ArrowRight,
  Footprints,
  Info,
  MapPin,
  TriangleAlert,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectHeader,
  SelectItem,
  SelectListBox,
  SelectPopover,
  SelectSection,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { resolveLabel } from "@/features/tenant/management/graph/utils/labels";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import type { GuestGuideMap } from "@/server/router";
import { type GuestPolling, useGuestPolling } from "../useGuestPolling";
import {
  ConnectorIcon,
  type GuideMapMarker,
  GuideMapView,
} from "./GuideMapView";
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
  localizeGuideMapLayout,
  type MapObject,
  type PlaceObject,
} from "./guideMapLayout";
import {
  clearGuideMapLink,
  consumeGuideMapRequest,
  setGuideMapPointIds,
  useGuideMapRequest,
} from "./guideMapLinkStore";
import { displayName, placeCategory, placePalette } from "./guideMapStyle";
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
        <p className="text-sm text-primary/70">
          {guideMap.status === "loading" ? t("loading") : t("loadError")}
        </p>
      </InfoCard>
    );
  return <GuideMapContent eventId={eventId} guideMap={guideMap.data} />;
}

function GuideMapContent({
  eventId,
  guideMap: { graph, layout, currentPointId },
}: {
  eventId: string;
  guideMap: GuestGuideMap;
}) {
  const t = useTranslations("Guest.guideMap");
  const tFloor = useTranslations("Guest.floor");
  const tCongestion = useTranslations("Guest.congestion");
  const locale = useLocale();
  const doc = useMemo(
    () =>
      localizeGuideMapLayout(
        layout,
        new Map(graph.points.map((p) => [p.pointId, p.labels])),
        locale,
      ),
    [layout, graph, locale],
  );

  const floorIndex = new Map(doc.groups.map((g, i) => [g.groupId, i]));
  const labelsByGroupId = new Map(
    graph.groups.map((g) => [g.groupId, g.labels]),
  );
  const floorNameOf = (id: string) =>
    resolveLabel(labelsByGroupId.get(id) ?? {}, locale).text;

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

  // プルダウンで選んだ目的地
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 表示名（グラフのポイントのラベルを表示言語で解決し、無ければレイアウトの名前を使う）
  // 全角の英数字（「４０３」など）は半角に直して、地図と同じ表記で出す
  const nameOf = (o: MapObject) => displayName(o.title);

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

  const pickRoom = (id: string) => {
    setSelectedId(id);
    // 経路は現在地から始まるので、現在地のフロアを表示する
    setGuideMapActiveFloor(startFloor);
  };
  const resetRoute = () => setSelectedId(null);

  // 行列・混雑状況のカードから「地図で見る」を頼まれたら、その場所を地図で見せる
  const cardRef = useRef<HTMLDivElement>(null);
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  useEffect(() => {
    setGuideMapPointIds(
      new Set(doc.objects.flatMap((o) => (o.pointId ? [o.pointId] : []))),
    );
    return () => clearGuideMapLink();
  }, [doc]);
  const request = useGuideMapRequest();
  // biome-ignore lint/correctness/useExhaustiveDependencies: 依頼（request）が来たときだけ動かす
  useEffect(() => {
    if (!request) return;
    consumeGuideMapRequest(request.seq);
    const targets = doc.objects.filter((o) => o.pointId === request.pointId);
    if (targets.length === 0) return;
    const destination = targets.find(
      (o): o is PlaceObject => isDestination(o) && o.id !== start?.id,
    );
    if (destination) {
      // 目的地ならそこへの道順を出す
      pickRoom(destination.id);
      setFocusIds(null);
    } else {
      // 目的地でない場所（エレベーター・通路など）は、その階を開いて、場所を波紋で示す
      setGuideMapActiveFloor(targets[0].groupId);
      setFocusIds(targets.map((o) => o.id));
    }
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [request]);
  // 強調は少し経ったら戻す
  useEffect(() => {
    if (!focusIds) return;
    const timer = setTimeout(() => setFocusIds(null), 4000);
    return () => clearTimeout(timer);
  }, [focusIds]);

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
  // 現在地は地図では青い点なので、吹き出しで「現在地」と添える
  if (start) markers.push({ objectId: start.id, label: t("currentLocation") });
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

  // 目的地のプルダウン（階ごとにまとめる。選ぶとすぐ経路を出す）
  const destinationsByFloor = doc.groups
    .map((g) => ({
      floor: g.groupId,
      items: destinations.filter((o) => o.groupId === g.groupId),
    }))
    .filter((f) => f.items.length > 0);

  // 表示中の階の切り替え（地図の上に出す）
  const floorTabs =
    doc.groups.length > 1 ? (
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[activeFloorId]}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next != null) setGuideMapActiveFloor(String(next));
        }}
        aria-label={tFloor("selectLabel")}
        // 横にはみ出す分はスクロールで見る。中央寄せだと左端の階に戻れなくなるので左から並べる
        className="flex [scrollbar-width:none] justify-start gap-1.5 overflow-x-auto"
      >
        {doc.groups.map((g) => (
          <Toggle
            key={g.groupId}
            id={g.groupId}
            size="sm"
            className="selected:border-accent selected:bg-accent selected:text-secondary h-11 min-w-11 shrink-0 rounded-full border border-primary/12 bg-secondary px-3.5 text-base font-bold whitespace-nowrap text-primary/70 tabular-nums hover:bg-secondary hover:text-accent"
          >
            {floorNameOf(g.groupId)}
          </Toggle>
        ))}
      </ToggleButtonGroup>
    ) : null;

  const toolbar = (
    <div className="mb-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Select
          aria-label={t("destinationsLabel")}
          placeholder={t("selectDestination")}
          selectedKey={selectedId}
          onSelectionChange={(key) => {
            if (key !== null) pickRoom(String(key));
          }}
          className="min-w-0 flex-1"
        >
          <SelectTrigger className="pressed:bg-primary/5 h-12 gap-3 rounded-xl border-primary/12 bg-secondary px-2.5 text-base text-primary shadow-sm transition-colors hover:border-accent/50 focus-visible:ring-accent/40 focus-visible:ring-offset-0">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
            >
              <MapPin className="size-4" />
            </span>
            <SelectValue className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
              {({ isPlaceholder }) =>
                isPlaceholder || !selected ? (
                  <span className="text-primary/70">
                    {t("selectDestination")}
                  </span>
                ) : (
                  <>
                    <span className="truncate font-medium">
                      {nameOf(selected)}
                    </span>
                    {doc.groups.length > 1 && (
                      <span className="shrink-0 text-xs text-primary/70">
                        {floorNameOf(selected.groupId)}
                      </span>
                    )}
                  </>
                )
              }
            </SelectValue>
          </SelectTrigger>
          {/* 一覧は body 直下に出るので、ゲスト画面の配色を引き継がせる */}
          <SelectPopover className="guest-theme max-h-80 overflow-hidden rounded-xl border-primary/12 bg-secondary text-primary shadow-lg">
            <SelectListBox className="max-h-80 p-1.5">
              {destinationsByFloor.map(({ floor: floorId, items }) => (
                <SelectSection key={floorId} className="not-first:mt-1">
                  {doc.groups.length > 1 && (
                    <SelectHeader className="sticky top-0 z-10 rounded-md bg-secondary/95 px-2.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-primary/70 backdrop-blur">
                      {floorNameOf(floorId)}
                    </SelectHeader>
                  )}
                  {items.map((o) => {
                    // 地図と同じ色（場所の種類の色。普通の部屋は中立色）
                    const color = placePalette(
                      o.color,
                      placeCategory(o.title, o.color),
                    );
                    return (
                      <SelectItem
                        key={o.id}
                        id={o.id}
                        textValue={nameOf(o)}
                        className="selected:font-medium selected:text-accent selection-single:pl-2.5 min-h-11 gap-3 rounded-lg px-2.5 text-base text-primary hover:bg-accent/10 hover:text-primary focus:bg-accent/10 focus:text-primary"
                      >
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-[4px] border"
                          style={{
                            background: color.fill,
                            borderColor: color.stroke,
                          }}
                        />
                        <span className="truncate">{nameOf(o)}</span>
                      </SelectItem>
                    );
                  })}
                </SelectSection>
              ))}
            </SelectListBox>
          </SelectPopover>
        </Select>

        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("reset")}
            className="size-12 shrink-0 rounded-xl text-primary/70 hover:bg-primary/5 hover:text-primary"
            onPress={resetRoute}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      {floorTabs}
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
  // いま地図に出している階の歩く区間の、次に歩く階（「次へ」で地図を送る）
  const walkFloors = steps.flatMap((s) => (s.kind === "walk" ? [s.floor] : []));
  const currentWalk = walkFloors.indexOf(activeFloorId);
  const nextFloor =
    currentWalk >= 0
      ? walkFloors.slice(currentWalk + 1).find((f) => f !== activeFloorId)
      : undefined;

  const footer = !selected ? null : route && "error" in route ? (
    <p className="mt-3 text-sm text-primary/70">{t("noRoute")}</p>
  ) : (
    <>
      {crowdNotice && (
        <p
          role="status"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
            throughDanger
              ? "bg-guest-notify/10 text-guest-notify"
              : "bg-accent/10 text-primary/80",
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
      <ol aria-label={t("stepsLabel")} className="mt-4">
        {steps.map((s, i) => {
          const current = s.kind === "walk" && s.floor === activeFloorId;
          return (
            <li
              key={`${s.fromId}-${s.toId}`}
              className="relative flex gap-3 pb-3 last:pb-0"
            >
              {/* 番号をつなぐ縦線 */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-8 bottom-0 left-3.5 w-px bg-primary/15"
                />
              )}
              <span
                aria-hidden
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                  current
                    ? "bg-accent text-secondary"
                    : "bg-primary/8 text-primary/70",
                )}
              >
                {i + 1}
              </span>
              {s.kind === "walk" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onPress={() => setGuideMapActiveFloor(s.floor)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "-mt-2 h-auto min-h-11 flex-1 justify-start gap-2 rounded-xl px-3 py-2 text-left text-sm whitespace-normal",
                    current
                      ? "bg-accent/10 text-primary ring-1 ring-accent/30 hover:bg-accent/15"
                      : "text-primary/80 hover:bg-primary/5",
                  )}
                >
                  <Footprints className="size-4 shrink-0 text-accent" />
                  {t("walkStep", {
                    floor: floorNameOf(s.floor),
                    from: objectName(s.fromId),
                    to: objectName(s.toId),
                  })}
                </Button>
              ) : (
                <p className="flex min-h-7 flex-1 items-center gap-2 px-3 text-sm text-primary/80">
                  <ConnectorIcon
                    type={s.via}
                    className="size-4 shrink-0 text-accent"
                  />
                  {t("rideStep", {
                    via: t(`connectors.${s.via}`),
                    from: floorNameOf(s.fromFloor),
                    to: floorNameOf(s.toFloor),
                  })}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {nextFloor && (
        <Button
          type="button"
          variant="outline"
          onPress={() => setGuideMapActiveFloor(nextFloor)}
          className="mt-3 h-11 w-full gap-2 rounded-xl border-accent/40 bg-accent/10 text-base font-medium text-primary hover:bg-accent/15"
        >
          {t("nextFloor", { floor: floorNameOf(nextFloor) })}
          <ArrowRight className="size-4" />
        </Button>
      )}
    </>
  );

  const floor =
    doc.groups.find((g) => g.groupId === activeFloorId) ?? doc.groups[0];

  return (
    // 行列・混雑状況のカードから飛んできたとき、固定ヘッダーに隠れない位置で止める
    <div ref={cardRef} className="scroll-mt-20">
      <GuideMapView
        title={t("title")}
        floor={floor}
        objects={floorObjects}
        routes={routes}
        markers={markers}
        activeId={selectedId}
        currentId={start?.id ?? null}
        toolbar={toolbar}
        footer={footer}
        focusIds={focusIds ?? undefined}
        zoomInLabel={t("expand")}
        zoomOutLabel={t("collapse")}
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
    </div>
  );
}

export default defineGuestInfoComponent("guide-map", GuideMap);
