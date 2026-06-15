"use client";

import { useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { messages } from "../i18n/messages";
import {
  type GuideMapDestination,
  type GuideMapRoom,
  GuideMapView,
  type GuideMapWaypoint,
  type MapPoint,
} from "./GuideMapView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

// --- ダミーのフロアデータ（本来は API から取得する） ---
const MAP_WIDTH = 320;
const MAP_HEIGHT = 240;

const roomGeometry: Omit<GuideMapRoom, "label">[] = [
  { id: "hall", x: 20, y: 20, width: 150, height: 90 },
  { id: "goods", x: 190, y: 20, width: 110, height: 70 },
  { id: "cafe", x: 190, y: 110, width: 110, height: 70 },
  { id: "exit", x: 20, y: 160, width: 90, height: 50 },
];

const waypoints: GuideMapWaypoint[] = [
  { id: "ev", label: "EV", point: { x: 160, y: 150 } },
];

const start: MapPoint = { x: 160, y: 224 };

const destinationIds = ["hall", "goods", "cafe", "exit"] as const;

const routes: Record<string, MapPoint[]> = {
  hall: [start, { x: 160, y: 150 }, { x: 95, y: 150 }, { x: 95, y: 110 }],
  goods: [start, { x: 160, y: 150 }, { x: 245, y: 150 }, { x: 245, y: 90 }],
  cafe: [start, { x: 160, y: 150 }, { x: 245, y: 150 }, { x: 245, y: 110 }],
  exit: [start, { x: 160, y: 200 }, { x: 65, y: 200 }, { x: 65, y: 160 }],
};

function GuideMap(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId で案内マップ API を取得する。
  //       QR 読み取り地点・目的地一覧・経由地点・経路・フロア形状。
  //       選択された目的地に応じた経路を API から取得（またはクライアントで探索）する。
  const { lang } = useLanguage();
  const g = messages[lang].guideMap;

  const [selectedDestinationId, setSelectedDestinationId] = useState<
    string | null
  >(null);

  const route = selectedDestinationId
    ? (routes[selectedDestinationId] ?? [])
    : [];

  // 部屋ラベル・目的地名は表示言語で解決する
  const rooms: GuideMapRoom[] = roomGeometry.map((room) => ({
    ...room,
    label: g.destinations[room.id] ?? room.id,
  }));
  const destinations: GuideMapDestination[] = destinationIds.map((id) => ({
    id,
    name: g.destinations[id] ?? id,
  }));

  return (
    <GuideMapView
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      rooms={rooms}
      waypoints={waypoints}
      start={start}
      destinations={destinations}
      selectedDestinationId={selectedDestinationId}
      route={route}
      onSelectDestination={setSelectedDestinationId}
      title={g.title}
      hint={g.hint}
      currentLocationLabel={g.currentLocation}
    />
  );
}

export default defineGuestInfoComponent("guide-map", GuideMap);
