"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { messages } from "../i18n/messages";
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

  const { lang } = useLanguage();
  const q = messages[lang].queue;

  return (
    <QueueLayoutView
      shape={shape}
      laneCount={4}
      peoplePerLane={5}
      direction="ltr"
      entrance={entrance}
      currentCount={5}
      labels={{
        title: q.title,
        shape: q.shape,
        direction: q.direction,
        entrance: q.entrance,
        entranceMarker: q.entranceMarker,
        current: q.current,
        max: q.max,
        people: q.people,
        shapeName: q.shapes[shape],
        entranceName: q.entrances[entrance],
      }}
    />
  );
}

export default defineGuestInfoComponent("queue-layout", QueueLayout);
