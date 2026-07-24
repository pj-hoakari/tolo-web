"use client";

import { useMemo } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { messages } from "../i18n/messages";
import { GuideMapView } from "./GuideMapView";
import {
  buildGuideMapSource,
  buildRoute,
  resolveMarkers,
  resolveRouteFlow,
} from "./guideMapAdapter";
import guideMapData from "./guideMapData.json";
import type { GuideMapSnapshot } from "./guideMapSchema";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

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
  //       いまはリポジトリ同梱の JSON を読み込んで表示している。
  const { lang } = useLanguage();
  const g = messages[lang].guideMap;

  // 部屋・経由地点を JSON から組み立てる（名称は i18n があれば優先）
  const source = useMemo(
    () =>
      buildGuideMapSource(
        snapshot,
        FLOOR_ID,
        (id, fallback) => g.destinations[id] ?? fallback,
      ),
    [g],
  );

  // 作成ツールで指定した道をそのまま表示する
  const route = useMemo(
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

  return (
    <GuideMapView
      width={source.width}
      height={source.height}
      rooms={source.rooms}
      waypoints={source.waypoints}
      start={MARKERS.start}
      route={route}
      title={g.title}
      currentLocationLabel={g.currentLocation}
      routeFlowClassName={ROUTE_FLOW.className}
      routeFlowDuration={ROUTE_FLOW.duration}
    />
  );
}

export default defineGuestInfoComponent("guide-map", GuideMap);
