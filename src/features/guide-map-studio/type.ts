// 案内マップ・スタジオで編集する地図の形（スタジオの中で使う形）。
//  - 会場画像を下敷き（floor.image）にして、その上に「場所・ルート・エリア・テキスト」を描く。
//  - 座標はすべて画像ピクセル（px・左上原点）。
//  - お客さんの画面の案内マップ（src/features/guest/info/guideMapLayout.ts）へは、utils/guideMapIO.ts でその形に変えて渡す。

import type {
  ConnectorDirection,
  ConnectorType,
  FloorImage,
  PlaceShape,
  Pt,
} from "@/features/guest/info/guideMapLayout";
import type { PLACE_KINDS } from "@/features/guest/info/guideMapStyle";
// 言語 → 名前（例：{ ja: "受付", en: "Reception" }）。グラフ編集と同じ型
import type { LocalizedLabel } from "@/features/tenant/management/graph/type";

// 点・場所の形・階をまたぐ移動手段・その向き・下敷きの画像の形は、お客さんの画面の案内マップと同じものを使う。
//  - ConnectorType：各階に1つずつ置き、同じ link を持つもの同士が「つながっている」
//  - ConnectorDirection：上り＝floors 配列の後ろの階へ（フロアタブの右側）。エスカレーターの一方通行に使う
//  - FloorImage：下敷きの会場画像（data URL で自己完結。無い場合は白紙＋グリッド）
// 混雑回避ルート用の混雑の形（お客さんの画面の案内マップと同じ）
export type {
  ConnectorDirection,
  ConnectorType,
  CrowdState,
  FloorImage,
  PlaceShape,
  Pt,
} from "@/features/guest/info/guideMapLayout";

export type ObjectKind = "place" | "route" | "area" | "text";

// groupId＝tolo-web のグラフ（グラフ編集）の「グループ（階）」の ID。tolo-web はこの ID で階を見分け、階の名前もグラフ側の名前を出す
export type Floor = {
  id: string;
  name: string;
  image?: FloorImage;
  groupId?: string;
};

type Base = {
  id: string;
  kind: ObjectKind;
  floor: string;
  title?: string;
  description?: string; // 任意。あればタップで情報カードに表示、無ければ出さない。
  color: string; // パレットキー（PALETTE のいずれか）
  closed?: boolean; // 通行止め（混雑など）。経路探索ではここを通らない／障害物扱いにする。
  graphPointId?: string; // 会場グラフ（tolo-web のグラフ編集）のポイント ID。混雑状況と結び付けて混雑回避ルートに使う
  graphRouteId?: string; // 会場グラフのルート（通路）ID。廊下などのエリア・線に付ける
  locked?: boolean; // 固定（スタジオで動かしたり消したりできないようにする。お客さんの画面には関係しない）
};

// 場所（ピン or 図形）＋タイトル・説明（Google マイマップの「場所」相当）
export type PlaceObject = Base & {
  kind: "place";
  x: number;
  y: number;
  shape: PlaceShape;
  w: number; // rect/circle の大きさ（pin では無視）
  h: number;
  pin?: boolean; // rect/circle の中心にピンを付ける（タップで情報カード）
  connector?: ConnectorType; // 階移動ポイント（shape は pin）。無ければ普通の場所
  link?: string; // 同じ値の階移動ポイント同士が階をまたいでつながる
  direction?: ConnectorDirection; // 省略時は both
  markW?: number; // ピン型の階移動マークの幅（px）。四角と同じように縦長・横長にできる
  markH?: number; // ピン型の階移動マークの高さ（px）
};
export type ConnectorObject = PlaceObject & {
  connector: ConnectorType;
  link: string;
};
// ルート（手描きの折れ線＝道路・順路。Scribble Maps の「線」相当）
export type RouteObject = Base & {
  kind: "route";
  points: Pt[];
  width: number;
  dash: boolean;
};
// エリア／境界線（塗りポリゴン。Scribble Maps の「境界線」・マイマップの「エリア」相当）
export type AreaObject = Base & {
  kind: "area";
  points: Pt[];
};
// テキストラベル
export type TextObject = Base & {
  kind: "text";
  x: number;
  y: number;
  size: number;
};
export type MapObject = PlaceObject | RouteObject | AreaObject | TextObject;

export type GuideMapDoc = {
  version: 1;
  floors: Floor[];
  activeFloorId: string;
  objects: MapObject[];
  north: number; // マップ上向きが指す方位角（度）。0=未設定
  scale: number; // 1px あたりのメートル（0=未設定）
  startId?: string; // 現在地（tolo-web の案内の出発点）にする場所の id。誘導プレビューの「出発」で選ぶ
  graph?: GuidanceGraph; // 結び付ける tolo-web のグラフ（スタジオの中だけで使う。tolo-web 用の書き出しには入れない）
};

// tolo-web のグラフ（グラフ編集の nodes / edges）から、スタジオで使う分だけ取り出したもの
export type GuidanceGraph = {
  groups: { id: string; labels: LocalizedLabel }[]; // 階・建物などのまとまり
  points: {
    id: string;
    labels: LocalizedLabel;
    groupId?: string;
    nodeType?: string;
  }[]; // ポイント（場所）
  routes: {
    id: string;
    labels: LocalizedLabel;
    source: string;
    target: string;
  }[]; // ルート（通路）
};

// 場所の種類（マーク）。色の項目（color）にこの値を書き出し、tolo-web はこれで色とアイコンを決める
export type PlaceKind = (typeof PLACE_KINDS)[number];
// 以前の色の名前（古いデータ用。色えらびには出さない。tolo-web はこの場所の種類を名前から推し量る）
type LegacyColor =
  | "indigo"
  | "rose"
  | "amber"
  | "emerald"
  | "sky"
  | "violet"
  | "slate";
export type PaletteKey = PlaceKind | LegacyColor | "navy" | "building";

// スタジオのタブ1枚分。タブはスタジオの中だけのもので、書き出すのは doc（GuideMapDoc）だけ。
export type StudioPage = { id: string; name: string; doc: GuideMapDoc };
export type StudioBook = { pages: StudioPage[]; activePageId: string };
