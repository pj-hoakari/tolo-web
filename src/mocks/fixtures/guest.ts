import type {
  GuestCrowdSnapshot,
  GuestMessage,
  GuestQueue,
} from "@/server/router";

type Names = { ja: string; en: string };

const name = (names: Names, language: string) =>
  language === "en" ? names.en : names.ja;

// 場所の名前は案内マップの会場（KCG本館 1F〜6F）に合わせている
export function sampleGuestCrowd(language: string): GuestCrowdSnapshot {
  return {
    takenAt: "2026-06-15T05:28:00.000Z",
    crowd: [
      {
        id: "pointId:p-elevator-1f",
        name: name({ ja: "1F エレベーター前", en: "1F elevators" }, language),
        level: "high",
        danger: true,
      },
      {
        id: "pointId:p-hall-6f",
        name: name({ ja: "6F ホール", en: "6F Hall" }, language),
        level: "mid",
        danger: false,
      },
      {
        id: "routeId:r-corridor-4f",
        name: name({ ja: "4F 廊下", en: "4F corridor" }, language),
        level: "low",
        danger: false,
      },
    ],
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
          pointId: "g-elevator",
          name: name({ ja: "エレベーター", en: "Elevators" }, language),
          recommended: false,
        },
        {
          pointId: "g-stairs",
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
          pointId: "g-lounge",
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
