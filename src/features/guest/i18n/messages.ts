import type { CongestionLevel } from "../info/CongestionView";
import type { QueueEntrance, QueueShape } from "../info/QueueLayoutView";

export type Lang = "ja" | "en" | "zh";

/** 言語切替ボタンに表示する一覧 */
export const LANGS: { code: Lang; label: string }[] = [
  { code: "ja", label: "JP" },
  { code: "en", label: "EN" },
  { code: "zh", label: "中" },
];

export type Messages = {
  pageSubtitle: string;
  waitingNumber: { title: string; unit: string };
  callingNumber: { title: string; unit: string };
  estimatedWaitTime: { title: string; prefix: string; unit: string };
  queue: {
    title: string;
    shape: string;
    direction: string;
    entrance: string;
    entranceMarker: string;
    current: string;
    max: string;
    people: string;
    shapes: Record<QueueShape, string>;
    entrances: Record<QueueEntrance, string>;
  };
  staffMessage: {
    title: string;
    ariaOpen: string;
    ariaClose: string;
    empty: string;
    /** 日時整形に使うロケール */
    locale: string;
  };
  guideMap: {
    title: string;
    hint: string;
    currentLocation: string;
    /** 目的地・部屋ラベルの名称（id をキーに） */
    destinations: Record<string, string>;
  };
  floor: { title: string };
  congestion: {
    title: string;
    levels: Record<CongestionLevel, string>;
  };
};

export const messages: Record<Lang, Messages> = {
  ja: {
    pageSubtitle: "ゲストページ",
    waitingNumber: { title: "現在の待ち人数", unit: "人" },
    callingNumber: { title: "現在の呼び出し番号", unit: "番" },
    estimatedWaitTime: { title: "推定待ち時間", prefix: "約", unit: "分" },
    queue: {
      title: "行列の並び方",
      shape: "形状",
      direction: "進行方向",
      entrance: "入口",
      entranceMarker: "入口",
      current: "現在",
      max: "最大",
      people: "人",
      shapes: {
        zigzag: "ジグザグ",
        straight: "直線",
        "l-shape": "L字",
        spiral: "らせん",
      },
      entrances: { top: "上", bottom: "下", left: "左", right: "右" },
    },
    staffMessage: {
      title: "スタッフからのお知らせ",
      ariaOpen: "スタッフからのお知らせ",
      ariaClose: "お知らせを閉じる",
      empty: "現在お知らせはありません",
      locale: "ja-JP",
    },
    guideMap: {
      title: "案内マップ",
      hint: "目的地を選択すると経路が表示されます",
      currentLocation: "現在地",
      destinations: {
        hall: "ホール",
        goods: "グッズ売り場",
        cafe: "カフェ",
        exit: "出口",
      },
    },
    floor: { title: "現在のフロア" },
    congestion: {
      title: "混雑状況",
      levels: { low: "低", mid: "中", high: "高" },
    },
  },
  en: {
    pageSubtitle: "Guest Page",
    waitingNumber: { title: "People waiting", unit: "people" },
    callingNumber: { title: "Now calling", unit: "" },
    estimatedWaitTime: {
      title: "Estimated wait",
      prefix: "approx.",
      unit: "min",
    },
    queue: {
      title: "Queue layout",
      shape: "Shape",
      direction: "Direction",
      entrance: "Entrance",
      entranceMarker: "Entry",
      current: "Now",
      max: "Max",
      people: "ppl",
      shapes: {
        zigzag: "Zigzag",
        straight: "Straight",
        "l-shape": "L-shape",
        spiral: "Spiral",
      },
      entrances: { top: "Top", bottom: "Bottom", left: "Left", right: "Right" },
    },
    staffMessage: {
      title: "Staff notices",
      ariaOpen: "Staff notices",
      ariaClose: "Close notices",
      empty: "No notices at the moment",
      locale: "en-US",
    },
    guideMap: {
      title: "Guide map",
      hint: "Select a destination to see the route",
      currentLocation: "You are here",
      destinations: {
        hall: "Hall",
        goods: "Merch",
        cafe: "Café",
        exit: "Exit",
      },
    },
    floor: { title: "Current floor" },
    congestion: {
      title: "Congestion",
      levels: { low: "Low", mid: "Medium", high: "High" },
    },
  },
  zh: {
    pageSubtitle: "访客页面",
    waitingNumber: { title: "当前等待人数", unit: "人" },
    callingNumber: { title: "当前叫号", unit: "号" },
    estimatedWaitTime: { title: "预计等待时间", prefix: "约", unit: "分钟" },
    queue: {
      title: "排队方式",
      shape: "形状",
      direction: "前进方向",
      entrance: "入口",
      entranceMarker: "入口",
      current: "当前",
      max: "最多",
      people: "人",
      shapes: {
        zigzag: "之字形",
        straight: "直线",
        "l-shape": "L形",
        spiral: "螺旋",
      },
      entrances: { top: "上", bottom: "下", left: "左", right: "右" },
    },
    staffMessage: {
      title: "工作人员通知",
      ariaOpen: "工作人员通知",
      ariaClose: "关闭通知",
      empty: "暂无通知",
      locale: "zh-CN",
    },
    guideMap: {
      title: "导览图",
      hint: "选择目的地以显示路线",
      currentLocation: "当前位置",
      destinations: {
        hall: "大厅",
        goods: "商品区",
        cafe: "咖啡厅",
        exit: "出口",
      },
    },
    floor: { title: "当前楼层" },
    congestion: {
      title: "拥挤状况",
      levels: { low: "低", mid: "中", high: "高" },
    },
  },
};
