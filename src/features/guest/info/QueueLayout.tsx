"use client";

import { useTranslations } from "next-intl";
import {
  type QueueEntrance,
  QueueLayoutView,
  type QueueShape,
} from "./QueueLayoutView";
import { defineGuestInfoComponent, type GuestInfoComponentProps } from "./type";

function QueueLayout(_props: GuestInfoComponentProps) {
  // TODO: _props.tenantId / _props.eventId で行列図示 API を取得する。
  //       目的地 ID・形状・列数・1列あたりの人数・進行方向・入口・現在の列内人数。
  //       場所ごとに列の形状が異なるため、取得した値をそのまま View に渡して動的に描画する。
  const shape: QueueShape = "zigzag";
  const entrance: QueueEntrance = "bottom";

  const t = useTranslations("Guest.queue");

  return (
    <QueueLayoutView
      shape={shape}
      laneCount={4}
      peoplePerLane={5}
      direction="ltr"
      entrance={entrance}
      currentCount={5}
      labels={{
        title: t("title"),
        shape: t("shape"),
        direction: t("direction"),
        entrance: t("entrance"),
        entranceMarker: t("entranceMarker"),
        current: t("current"),
        max: t("max"),
        people: t("people"),
        shapeName: t(`shapes.${shape}`),
        entranceName: t(`entrances.${entrance}`),
      }}
    />
  );
}

export default defineGuestInfoComponent("queue-layout", QueueLayout);
