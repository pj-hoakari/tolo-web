// スタジオの部品どうしで使う決まり（道具の種類・地図のまわりの余白）

// 地図のまわりに取る余白（px）。この分だけ地図の外までスクロールできる
export const PAN_PAD = 400;

// スマートガイド・道案内など、画面で目立たせる所の色（アクセント1色。ライト/ダークで変わる）
export const GUIDE = "var(--studio-accent)";

export type Tool =
  | "select"
  | "rect"
  | "circle"
  | "pin"
  | "area"
  | "text"
  | "connector";

export type Corner = "nw" | "ne" | "sw" | "se";
