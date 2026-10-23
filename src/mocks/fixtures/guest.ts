import type {
  GuestCrowdSnapshot,
  GuestMessage,
  GuestQueue,
} from "@/server/router";

type Names = { ja: string; en: string };

const name = (names: Names, language: string) =>
  language === "en" ? names.en : names.ja;

export function sampleGuestCrowd(language: string): GuestCrowdSnapshot {
  return {
    takenAt: "2026-06-15T05:28:00.000Z",
    crowd: [
      {
        id: "pointId:p-entrance",
        name: name({ ja: "入場ゲート", en: "Entrance gate" }, language),
        level: "high",
        danger: true,
      },
      {
        id: "pointId:p-hall",
        name: name({ ja: "ホール", en: "Hall" }, language),
        level: "mid",
        danger: false,
      },
      {
        id: "routeId:r-cafe",
        name: name({ ja: "カフェ通路", en: "Café corridor" }, language),
        level: "low",
        danger: false,
      },
    ],
  };
}

export function sampleGuestQueues(language: string): GuestQueue[] {
  return [
    {
      queueId: "q-goods",
      name: name({ ja: "グッズ売り場", en: "Merchandise" }, language),
      waitTimeMinutes: 12.2,
      gates: [
        {
          pointId: "g-east",
          name: name({ ja: "東ゲート", en: "East gate" }, language),
          recommended: false,
        },
        {
          pointId: "g-west",
          name: name({ ja: "西ゲート", en: "West gate" }, language),
          recommended: true,
        },
      ],
    },
    {
      queueId: "q-cafe",
      name: name({ ja: "カフェ", en: "Café" }, language),
      waitTimeMinutes: 3,
      gates: [
        {
          pointId: "g-cafe",
          name: name({ ja: "カフェ入口", en: "Café entrance" }, language),
          recommended: true,
        },
      ],
    },
  ];
}

export const sampleGuestMessages: GuestMessage[] = [
  {
    messageId: "msg-1",
    body: "開演時刻が 15:00 から 15:30 に変更となりました。ご了承ください。",
    sentAt: "2026-06-15T04:05:00.000Z",
  },
  {
    messageId: "msg-2",
    body: "東ゲート付近が大変混雑しています。お急ぎの方は西ゲートのご利用をおすすめします。",
    sentAt: "2026-06-15T05:30:00.000Z",
  },
];
