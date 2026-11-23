// 部屋・区画の名前の出し方（部屋の大きさに合わせる）。画面の地図と、画像・印刷の SVG で同じものを使う。
//  - 基本の大きさは部屋の大きさに合わせる（11〜22px）。大きい部屋・区画ほど少し大きくするが、地図の上で目立ちすぎない程度にとどめる
//  - 1 行で入る大きさと、2 行に分けて入る大きさ（お客さんの画面と同じ splitName の分け方）を比べ、大きく出せる方にする
//  - それでも MIN_SIZE より小さくなるときは MIN_SIZE で 1 行にし、入らない分は … で切る（画面は CSS、SVG は fitText）
import { splitName } from "@/features/guest/info/guideMapStyle";

const MIN_SIZE = 9;
const BASE_MIN = 11;
const BASE_MAX = 22;
const LINE_HEIGHT = 1.2;
// 左右の余白（px）
const PAD_X = 8;

/** 文字列の幅（em）。半角はおよそ 0.6、全角は 1。spacing は 1 文字あたりの字間（em） */
export function textEm(text: string, spacing = 0, mono = false) {
  let em = 0;
  for (const ch of text) em += /[\x20-\x7e]/.test(ch) || mono ? 0.6 : 1;
  return em + [...text].length * spacing;
}

/**
 * 名前を、幅 w・高さ h の部屋の中に出すときの行と文字の大きさ。
 * reserved＝名前より上に置く物（目印・マーク）の高さの合計（px）。mono＝等幅の字（番号だけの名前）
 */
export function roomLabel(
  text: string,
  w: number,
  h: number,
  { reserved = 0, spacing = 0.04, mono = false } = {},
): { lines: string[]; size: number } {
  const name = text.trim();
  if (!name) return { lines: [], size: BASE_MIN };
  const base = Math.max(BASE_MIN, Math.min(BASE_MAX, Math.min(w / 8, h / 4.5)));
  const availW = Math.max(0, w - PAD_X * 2) * 0.94;
  const availH = Math.max(0, h * 0.88 - reserved);
  const one = Math.min(
    base,
    availW / textEm(name, spacing, mono),
    availH / LINE_HEIGHT,
  );
  const [a, b] = splitName(name);
  const two = b
    ? Math.min(
        base,
        availW / Math.max(textEm(a, spacing, mono), textEm(b, spacing, mono)),
        availH / (LINE_HEIGHT * 2),
      )
    : 0;
  // 2 行の方がはっきり大きく出せるときだけ 2 行にする（同じくらいなら 1 行のまま）
  if (two >= MIN_SIZE && two > one * 1.15) return { lines: [a, b], size: two };
  return { lines: [name], size: Math.max(MIN_SIZE, one) };
}

/**
 * 四角・丸の階段・エレベーターの、アイコンと名前の大きさ。
 * 部屋と同じく部屋の大きさに合わせる（部屋を「階段・EVとして使う」にしても、マークや名前が小さくならないように）。
 * 名前の下に出す「つながる階」（10px・1 行）の分も、名前に使える高さから引く。画面と画像（guideMapSvg.ts）で同じ大きさにする
 */
export function connectorRoomLayout(
  o: { w: number; h: number; labelScale?: number; markScale?: number },
  text: string,
): { icon: number; lines: string[]; size: number } {
  const icon =
    Math.max(14, Math.min(32, Math.min(o.w, o.h) * 0.3)) * (o.markScale ?? 1);
  const label = roomLabel(text, o.w, o.h, { reserved: icon + 4 + 19 });
  return {
    icon,
    lines: label.lines,
    size: label.size * (o.labelScale ?? 1),
  };
}
