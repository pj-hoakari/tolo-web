import type { MapObject, PlaceObject, Pt } from "../type";
import type { Box } from "./guideMapSnap";

// スタジオの部品どうしで使う決まり（道具の種類・地図のまわりの余白）

// 地図のまわりに取る余白（px）。この分だけ地図の外までスクロールできる
export const PAN_PAD = 400;

// スマートガイド・道案内など、画面で目立たせる所の色（アクセント1色。ライト/ダークで変わる）
export const GUIDE = "var(--studio-accent)";

// 選択中の強調（アクセント色の太いリング＋外側のハロー）
export const SEL = "var(--primary)";

export type Tool =
  | "select"
  | "rect"
  | "circle"
  | "pin"
  | "area"
  | "text"
  | "connector";

export type Corner = "nw" | "ne" | "sw" | "se";

// 地図の上でのドラッグの種類と、その開始時の状態
export type Drag =
  | {
      kind: "pan";
      cx: number;
      cy: number;
      sl: number;
      st: number;
      moved: boolean;
      tap?: string | null;
    }
  | {
      kind: "move";
      ids: string[];
      pressed: string;
      additive: boolean;
      start: Pt;
      rawStart: Pt;
      origins: Record<string, MapObject>;
      box: Box;
      others: Box[];
      moved: boolean;
    }
  | { kind: "vertex"; id: string; index: number; origin: Pt[] } // origin＝ドラッグ開始時の頂点（辺の向きの判定に使う）
  | { kind: "draw"; shape: "rect" | "circle" | "area"; start: Pt; cur: Pt }
  | {
      kind: "resize";
      id: string;
      corner: Corner;
      origin: PlaceObject;
      others: Box[];
    }
  | { kind: "marquee"; start: Pt; raw: Pt; base: string[] } // base＝Shift で足すときの元の選択、raw＝押した位置（クリック判定用）
  | null;
