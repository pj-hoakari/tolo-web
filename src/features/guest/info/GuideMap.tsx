"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";
import { VenueDirections } from "./VenueDirections";
import { buildVenueNav, type VenueMap } from "./venueMap";
import venueMap from "./venueMap.json";

function GuideMap(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId で会場マップ・現在地を API から取得する。
  //       いまはリポジトリ同梱の venueMap.json（guide-map-poc の書き出し）を使う。
  const locale = useLocale();

  // 会場マップ（1 ファイル）を道案内モデルへ変換する
  const model = useMemo(
    () => buildVenueNav(venueMap as unknown as VenueMap, locale),
    [locale],
  );

  // 現在地（入口などの候補の先頭）。将来は QR / API から受け取る。
  const currentId = model.starts[0]?.id ?? null;

  return <VenueDirections model={model} currentId={currentId} />;
}

export default defineGuestInfoComponent("guide-map", GuideMap);
