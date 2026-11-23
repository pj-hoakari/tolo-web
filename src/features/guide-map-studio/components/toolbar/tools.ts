import {
  ArrowUpDown,
  Circle as CircleIcon,
  MapPin,
  MousePointer2,
  Pentagon,
  Square,
  Type,
} from "lucide-react";
import type { ComponentType } from "react";
import type { Tool } from "../../utils/shared";

// 名前は「何を置く道具か」で呼ぶ（形の名前ではなく用途）。shortcut＝その道具を選ぶキー、desc＝使い方の説明（マウスを置くと出る）
export const TOOLS: {
  key: Tool;
  label: string;
  short?: string;
  shortcut: string;
  desc: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  {
    key: "select",
    label: "選択",
    shortcut: "V",
    desc: "地図の物を選んで、動かしたり大きさを変えたりします。何もない所をドラッグすると、まとめて選べます。動かすとほかの物の縁やグリッドにそろうよう吸い付きます。Alt（option）を押しながら操作すると、吸い付かずに好きな位置・大きさにできます。",
    Icon: MousePointer2,
  },
  {
    key: "rect",
    label: "部屋・区画",
    shortcut: "R",
    desc: "ドラッグして、部屋や売り場を描きます。部屋どうしのすき間が、お客さんの通る道になります。",
    Icon: Square,
  },
  {
    key: "circle",
    label: "丸い区画",
    shortcut: "C",
    desc: "ドラッグして、丸い形の区画（ブース・広場など）を描きます。",
    Icon: CircleIcon,
  },
  {
    key: "pin",
    label: "目印（ピン）",
    short: "目印",
    shortcut: "P",
    desc: "クリックした所に目印を置きます。入口・案内所など、部屋ではない場所に使います。",
    Icon: MapPin,
  },
  {
    key: "area",
    label: "範囲",
    shortcut: "A",
    desc: "ドラッグして範囲を囲みます。待機列の場所、通行止めにする所、建物全体などを示すのに使います。",
    Icon: Pentagon,
  },
  {
    key: "text",
    label: "文字",
    shortcut: "T",
    desc: "クリックした所に文字を置きます。建物名や「本館」などの見出しに使います。",
    Icon: Type,
  },
  {
    key: "connector",
    label: "階段・EV",
    shortcut: "E",
    desc: "クリックした所に階段・エスカレーター・エレベーターを置きます。全部の階の同じ位置に置かれます。",
    Icon: ArrowUpDown,
  },
];
