import { toGuestGuideMapGraph } from "@/features/guest/info/guideMapGraph";
import type { LocalizedGuideMapLayout } from "@/features/guest/info/guideMapLayout";
import type { GraphData } from "@/features/tenant/management/graph/type";
import type {
  GuestCrowdSnapshot,
  GuestGuideMap,
  GuestMessage,
  GuestQueue,
} from "@/server/router";
import guideMapGraph from "./guideMapGraph.json";
import guideMapLayout from "./guideMapLayout.json";

type Names = { ja: string; en: string };

const name = (names: Names, language: string) =>
  language === "en" ? names.en : names.ja;

// 場所の名前は案内マップの会場（KCG本館 1F〜6F）に合わせている
export function sampleGuestCrowd(language: string): GuestCrowdSnapshot {
  return {
    takenAt: "2026-06-15T05:28:00.000Z",
    crowd: [
      {
        id: "pointId:n_fc14f2f4",
        name: name({ ja: "1F エレベーター前", en: "1F elevators" }, language),
        level: "high",
        danger: true,
      },
      {
        id: "pointId:n_ca0bb1fc",
        name: name({ ja: "6F ホール", en: "6F Hall" }, language),
        level: "mid",
        danger: false,
      },
      {
        id: "pointId:n_12408172",
        name: name({ ja: "4F 廊下", en: "4F corridor" }, language),
        level: "low",
        danger: false,
      },
    ],
  };
}

export const sampleGuideMapGraph = guideMapGraph as GraphData;

export type SampleGraphAnchor =
  | { pointId: string }
  | { routeId: string; routePosition?: number };

export const sampleQrLocations = new Map<string, SampleGraphAnchor>([
  ["3f1c9a0b7d2e4a65", { pointId: "n_8b38f377" }],
  ["a84d0e6c2b9f1735", { pointId: "n_6f8f9cc6" }],
  ["5b2e8d0f4c7a1936", { routeId: "e_13f3dd5a", routePosition: 0.5 }],
  ["c9d47e1a03b65f28", { pointId: "n_2f44fa0f" }],
]);

export function sampleGuideMap(qrLocationId?: string): GuestGuideMap {
  const layout = guideMapLayout as unknown as LocalizedGuideMapLayout;
  const anchor = qrLocationId ? sampleQrLocations.get(qrLocationId) : undefined;
  const currentPointId =
    anchor &&
    "pointId" in anchor &&
    layout.objects.some((o) => o.pointId === anchor.pointId)
      ? anchor.pointId
      : undefined;
  return {
    graph: toGuestGuideMapGraph(sampleGuideMapGraph, layout),
    layout,
    ...(currentPointId ? { currentPointId } : {}),
  };
}

export function sampleGuestQueues(language: string): GuestQueue[] {
  return [
    {
      queueId: "q-hall-6f",
      name: name({ ja: "6F ホール", en: "6F Hall" }, language),
      waitTimeMinutes: 12.2,
      gates: [
        {
          pointId: "n_0dfb7c9e",
          name: name({ ja: "エレベーター", en: "Elevators" }, language),
          recommended: false,
        },
        {
          pointId: "n_99fe5704",
          name: name({ ja: "階段", en: "Stairs" }, language),
          recommended: true,
        },
      ],
    },
    {
      queueId: "q-lounge-4f",
      name: name({ ja: "4F ラウンジ", en: "4F Lounge" }, language),
      waitTimeMinutes: 3,
      gates: [
        {
          pointId: "n_6f8f9cc6",
          name: name({ ja: "ラウンジ入口", en: "Lounge entrance" }, language),
          recommended: true,
        },
      ],
    },
  ];
}

export const sampleGuestMessages: GuestMessage[] = [
  {
    messageId: "msg-1",
    body: "6F ホールの開演時刻が 15:00 から 15:30 に変更となりました。ご了承ください。",
    sentAt: "2026-06-15T04:05:00.000Z",
  },
  {
    messageId: "msg-2",
    body: "1F エレベーター前が大変混雑しています。お急ぎの方は階段のご利用をおすすめします。",
    sentAt: "2026-06-15T05:30:00.000Z",
  },
];
