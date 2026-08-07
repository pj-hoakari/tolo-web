"use client";

import { Search, X } from "lucide-react";
import type { Messages } from "next-intl";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, TextField } from "@/components/ui/textfield";
import { GuideMapView } from "./GuideMapView";
import {
  buildGuideMapSource,
  buildRoute,
  buildRouteToRoom,
  estimateWalk,
  resolveMarkers,
  resolveRouteFlow,
} from "./guideMapAdapter";
import guideMapData from "./guideMapData.json";
import type { GuideMapSnapshot } from "./guideMapSchema";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

/** マップ JSON の id を Guest.guideMap.destinations のキーとして扱うための型 */
type DestinationKey =
  `destinations.${keyof Messages["Guest"]["guideMap"]["destinations"] & string}`;

/** マップ作成ツール（guide-map-poc）から書き出した JSON */
const snapshot = guideMapData as GuideMapSnapshot;

/** 表示するフロア。TODO: 複数フロア対応時は選択できるようにする */
const FLOOR_ID = snapshot.activeFloorId;

/** 出発が未設定の JSON 用のフォールバック。TODO: QR / API から現在地を受け取る */
const FALLBACK_START = { x: 432, y: 192 };

/** 現在地・目的地マーカー（JSON にあればその座標、無ければカードから算出） */
const MARKERS = resolveMarkers(snapshot, FALLBACK_START);

/** 線の見た目（流れる破線）も作成ツールの設定に合わせる */
const ROUTE_FLOW = resolveRouteFlow(snapshot);

function GuideMap(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId でマップ JSON と現在地を API から取得する。
  const t = useTranslations("Guest.guideMap");

  // 目的地検索の入力と、検索/一覧から選んだ目的地
  const [query, setQuery] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // 部屋・経由地点を JSON から組み立てる（名称は i18n があれば優先）
  const source = useMemo(
    () =>
      buildGuideMapSource(snapshot, FLOOR_ID, (id, fallback) => {
        const key = `destinations.${id}` as DestinationKey;
        return t.has(key) ? t(key) : fallback;
      }),
    [t],
  );

  // 作成ツールで指定した既定ルート
  const defaultRoute = useMemo(
    () =>
      buildRoute(
        snapshot,
        FLOOR_ID,
        MARKERS.start,
        MARKERS.end,
        source.width,
        source.height,
      ),
    [source.width, source.height],
  );

  // 選択した目的地への経路（未選択なら既定ルート）
  const selected = useMemo(
    () =>
      selectedRoomId
        ? buildRouteToRoom(
            snapshot,
            FLOOR_ID,
            MARKERS.start,
            selectedRoomId,
            source.width,
            source.height,
          )
        : null,
    [selectedRoomId, source.width, source.height],
  );

  const route = selected ? selected.points : defaultRoute;

  // 検索一致する部屋（名称の部分一致・大文字小文字を無視）
  const q = query.trim().toLowerCase();
  const matches = q
    ? source.rooms.filter((r) => r.label.toLowerCase().includes(q))
    : [];
  const highlightIds = matches.map((r) => r.id);

  // 距離・所要時間の目安ラベル
  const { meters, minutes } = estimateWalk(route);
  const distanceLabel =
    route.length > 1
      ? `${meters}${t("distanceUnit")} · ${t("walkPrefix")}${minutes}${t("minuteUnit")} (${t("estimate")})`
      : undefined;

  const pickRoom = (id: string) => {
    setSelectedRoomId(id);
    setQuery("");
  };
  const resetRoute = () => {
    setSelectedRoomId(null);
    setQuery("");
  };
  // Enter で、候補があれば先頭を選ぶ（クリックと同じ挙動）
  const submitSearch = () => {
    if (matches.length > 0) pickRoom(matches[0].id);
  };

  const selectedLabel = selectedRoomId
    ? source.rooms.find((r) => r.id === selectedRoomId)?.label
    : null;

  const toolbar = (
    <div className="mb-3 space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-primary/40" />
        <TextField
          aria-label={t("search")}
          value={query}
          onChange={setQuery}
          className="w-full"
        >
          <Input
            placeholder={t("search")}
            className="h-9 pl-8"
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
            matches.slice(0, 8).map((r) => (
              <Button
                key={r.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full border-primary/12 px-3 text-primary/70 text-sm hover:text-accent"
                onPress={() => pickRoom(r.id)}
              >
                {r.label}
              </Button>
            ))
          ) : (
            <span className="text-primary/45 text-sm">{t("noResults")}</span>
          )}
        </div>
      )}

      {selectedLabel && !q && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent px-3 py-1 font-medium text-secondary text-sm">
            {selectedLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-primary/55 text-xs"
            onPress={resetRoute}
          >
            <X className="size-3.5" />
            {t("reset")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <GuideMapView
      width={source.width}
      height={source.height}
      rooms={source.rooms}
      waypoints={source.waypoints}
      start={MARKERS.start}
      route={route}
      title={t("title")}
      hint={t("hint")}
      currentLocationLabel={t("currentLocation")}
      destinationsLabel={t("destinationsLabel")}
      expandLabel={t("expand")}
      collapseLabel={t("collapse")}
      routeFlowClassName={ROUTE_FLOW.className}
      routeFlowDuration={ROUTE_FLOW.duration}
      highlightIds={q ? highlightIds : undefined}
      activeRoomId={selectedRoomId}
      distanceLabel={distanceLabel}
      toolbar={toolbar}
    />
  );
}

export default defineGuestInfoComponent("guide-map", GuideMap);
