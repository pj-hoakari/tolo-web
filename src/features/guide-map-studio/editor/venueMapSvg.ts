// 1つの階を、ひとつながりの SVG（文字列）として描く。
// 「見比べる」の表示・画像（PNG）保存・印刷に使う。画面のキャンバスと同じ「図面風」の見た目を、色を直接書いて再現する
// （画像や印刷では CSS の変数が効かないため）。

import { areaLabelSize, roomLabel } from "./roomLabel";
import {
  bboxOf,
  type ConnectorType,
  type Floor,
  floorSize,
  isConnector,
  markBoxOf,
  paletteOf,
  shownColorOf,
  type VenueMapDoc,
} from "./venueMap";
import { boxOf, unionBox } from "./venueSnap";

export type SvgTheme = {
  bg: string;
  surface: string;
  divider: string;
  text: string;
  muted: string;
  accent: string;
};
export const SVG_LIGHT: SvgTheme = {
  bg: "#f5f0e8",
  surface: "#fbf8f3",
  divider: "#e2dace",
  text: "#2a2622",
  muted: "#6e655c",
  accent: "#e07a3f",
};
export const SVG_DARK: SvgTheme = {
  bg: "#1c1916",
  surface: "#26221e",
  divider: "#3a342e",
  text: "#ede6da",
  muted: "#9a9086",
  accent: "#f0955a",
};

const FONT =
  "'IBM Plex Sans JP','Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',sans-serif";
const MONO = "'IBM Plex Mono',ui-monospace,Menlo,monospace";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// 2色を混ぜる（a を pct% 、残りを b）
function mix(a: string, b: string, pct: number) {
  const p = (h: string) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x
    .map((v, i) =>
      Math.round((v * pct) / 100 + (y[i] * (100 - pct)) / 100)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// 枠に入る長さまで文字を切る（全角は 1 文字 ≒ fontSize、半角は ≒ 0.6 倍）
function fitText(text: string, width: number, size: number) {
  let used = 0;
  let out = "";
  for (const ch of text) {
    used += /[\x20-\x7e]/.test(ch) ? size * 0.6 : size;
    if (used > width) return `${out}…`;
    out += ch;
  }
  return out;
}

const ICON: Record<ConnectorType, string> = {
  stairs: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  escalator: '<path d="M3 20h4L17 8h4"/><path d="m14 4 3 0 0 3"/>',
  elevator:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 10 3-3 3 3"/><path d="m9 14 3 3 3-3"/>',
};
const icon = (
  type: ConnectorType,
  cx: number,
  cy: number,
  size: number,
  color: string,
) =>
  `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[type]}</g>`;

/** 階の中身が収まる範囲（何も無ければ階の広さ） */
export function floorBounds(
  doc: Pick<VenueMapDoc, "floors" | "objects">,
  floor: Floor,
  pad = 40,
) {
  const objs = doc.objects.filter((o) => o.floor === floor.id);
  const boxes = objs.map((o) => {
    const b = boxOf(o);
    // ピン・文字は点なので、名前の分だけ広げる
    if (o.kind === "text")
      return { l: b.l - 80, t: b.t - o.size, r: b.r + 80, b: b.b + o.size };
    if (o.kind === "place" && o.shape === "pin")
      return { l: b.l - 70, t: b.t - 36, r: b.r + 70, b: b.b + 24 };
    return b;
  });
  if (floor.image)
    boxes.push({ l: 0, t: 0, r: floor.image.w, b: floor.image.h });
  if (boxes.length === 0) {
    const { w, h } = floorSize(floor);
    return { x: 0, y: 0, w, h };
  }
  const u = unionBox(boxes);
  return {
    x: u.l - pad,
    y: u.t - pad,
    w: u.r - u.l + pad * 2,
    h: u.b - u.t + pad * 2,
  };
}

export type FloorSvgOptions = {
  theme?: SvgTheme;
  untitled?: string;
  closedLabel?: string;
  title?: string;
};

/** 階を SVG 文字列にする。width/height は SVG の大きさ（地図の 1 単位 = 1px） */
export function floorSvg(
  doc: Pick<VenueMapDoc, "floors" | "objects">,
  floorId: string,
  opts: FloorSvgOptions = {},
) {
  const th = opts.theme ?? SVG_LIGHT;
  const floor = doc.floors.find((f) => f.id === floorId) ?? doc.floors[0];
  const box = floorBounds(doc, floor);
  const head = opts.title ? 44 : 0;
  const objs = doc.objects.filter((o) => o.floor === floor.id);
  const line = (c: string) => mix(c, th.divider, 70);
  const out: string[] = [];
  out.push(
    `<rect x="${box.x}" y="${box.y - head}" width="${box.w}" height="${box.h + head}" fill="${th.bg}"/>`,
  );
  if (opts.title)
    out.push(
      `<text x="${box.x + 24}" y="${box.y - head + 30}" font-family="${FONT}" font-size="18" fill="${th.text}" letter-spacing="1">${esc(opts.title)}</text>`,
    );
  if (floor.image)
    out.push(
      `<image href="${esc(floor.image.src)}" x="0" y="0" width="${floor.image.w}" height="${floor.image.h}" preserveAspectRatio="none"/>`,
    );

  // エリア（最背面）
  for (const o of objs) {
    if (o.kind !== "area") continue;
    const { fill: pal, stroke } = paletteOf(shownColorOf(o));
    const pts = o.points.map((p) => `${p.x},${p.y}`).join(" ");
    // 範囲の縁は画面と同じ実線の枠（通行止めだけ点線）
    const building = o.color === "building";
    out.push(
      `<polygon points="${pts}" fill="${building ? th.surface : pal}" fill-opacity="${building ? 0.6 : o.closed ? 0.24 : 0.16}" stroke="${stroke}" stroke-width="${building ? 3 : 2}" stroke-linejoin="round"${o.closed ? ' stroke-dasharray="6 3"' : ""}/>`,
    );
    if (o.title) {
      const bb = bboxOf(o.points);
      const label = `${o.title}${o.closed && opts.closedLabel ? opts.closedLabel : ""}`;
      out.push(
        `<text x="${bb.x + bb.w / 2}" y="${bb.y + areaLabelSize(bb.w, bb.h) + 8}" text-anchor="middle" font-family="${MONO}" font-size="${areaLabelSize(bb.w, bb.h)}" letter-spacing="1" fill="${o.closed ? th.accent : th.muted}" stroke="${th.bg}" stroke-width="3" paint-order="stroke" stroke-linejoin="round">${esc(label)}</text>`,
      );
    }
  }
  // 線（順路など）
  for (const o of objs) {
    if (o.kind !== "route" || o.points.length < 2) continue;
    const pal = paletteOf(shownColorOf(o)).fill;
    out.push(
      `<polyline points="${o.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${pal}" stroke-width="${o.width}" stroke-linecap="round" stroke-linejoin="round"${o.dash ? ' stroke-dasharray="10 8"' : ""}/>`,
    );
  }
  // 部屋・ピン・階段など
  for (const o of objs) {
    if (o.kind !== "place") continue;
    const pal = paletteOf(shownColorOf(o)).fill;
    const ln = line(pal);
    const title = o.title || "";
    if (isConnector(o) && o.shape === "pin") {
      const mb = markBoxOf(o);
      out.push(
        `<rect x="${o.x - mb.w / 2}" y="${o.y - mb.h / 2}" width="${mb.w}" height="${mb.h}" rx="6" fill="${th.surface}" stroke="${ln}"/>`,
      );
      out.push(icon(o.connector, o.x, o.y, Math.min(mb.w, mb.h) * 0.56, ln));
      if (title)
        out.push(
          `<text x="${o.x}" y="${o.y + mb.h / 2 + 14}" text-anchor="middle" font-family="${MONO}" font-size="10" letter-spacing="0.8" fill="${th.text}" stroke="${th.bg}" stroke-width="3" paint-order="stroke">${esc(title)}</text>`,
        );
      continue;
    }
    if (o.shape === "pin") {
      out.push(
        `<circle cx="${o.x}" cy="${o.y}" r="8" fill="none" stroke="${ln}"/>`,
      );
      out.push(`<circle cx="${o.x}" cy="${o.y}" r="4" fill="${pal}"/>`);
      if (title) {
        const tw = Math.min(
          160,
          [...title].reduce(
            (s, ch) => s + (/[\x20-\x7e]/.test(ch) ? 6.6 : 11),
            0,
          ) + 16,
        );
        out.push(
          `<rect x="${o.x - tw / 2}" y="${o.y - 34}" width="${tw}" height="20" rx="6" fill="${th.surface}" stroke="${th.divider}"/>`,
        );
        out.push(
          `<text x="${o.x}" y="${o.y - 20}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${th.text}">${esc(fitText(title, tw - 12, 11))}</text>`,
        );
      }
      continue;
    }
    // 四角・丸
    const x = o.x - o.w / 2;
    const y = o.y - o.h / 2;
    const fill = mix(pal, th.surface, 8);
    if (o.shape === "circle")
      out.push(
        `<ellipse cx="${o.x}" cy="${o.y}" rx="${o.w / 2}" ry="${o.h / 2}" fill="${fill}" stroke="${ln}"/>`,
      );
    else {
      out.push(
        `<rect x="${x}" y="${y}" width="${o.w}" height="${o.h}" rx="6" fill="${fill}" stroke="${ln}"/>`,
      );
      if (!isConnector(o))
        out.push(
          `<rect x="${x}" y="${y + 1}" width="3" height="${Math.max(0, o.h - 2)}" fill="${pal}"/>`,
        );
    }
    if (isConnector(o)) {
      out.push(icon(o.connector, o.x, o.y - (title ? 9 : 0), 18, ln));
      if (title)
        out.push(
          `<text x="${o.x}" y="${o.y + 16}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="${th.text}">${esc(fitText(title, o.w - 16, 12))}</text>`,
        );
      continue;
    }
    // 「101 受付」のような名前は、番号を左上に小さく出す（画面と同じ）
    const m = title
      .trim()
      .match(/^([0-9０-９A-Za-zＡ-Ｚａ-ｚ\-－]+)(?:\s+(.+))?$/);
    const num = m
      ? m[1].replace(/[０-９Ａ-Ｚａ-ｚ－]/g, (c) =>
          String.fromCharCode(c.charCodeAt(0) - 0xfee0),
        )
      : "";
    const name = m ? (m[2] ?? "") : title.trim();
    if (num && name)
      out.push(
        `<text x="${x + 10}" y="${y + 16}" font-family="${MONO}" font-size="10" letter-spacing="1" fill="${th.muted}">${esc(num)}</text>`,
      );
    // 名前（無ければ番号）は部屋の大きさに合わせた大きさで、入らなければ 2 行に分ける（画面と同じ roomLabel.ts）
    const label = roomLabel(name || num, o.w, o.h, {
      reserved: o.pin ? 18 + 6 : 0,
      spacing: name ? 0.04 : 0.12,
      mono: !name,
    });
    // 目印（18px）・すき間（6px）・名前を 1 つにまとめて、部屋の真ん中に縦に並べる（画面と同じ並び）
    const pinH = o.pin ? 18 + (label.lines.length ? 6 : 0) : 0;
    const lineH = label.size * 1.2;
    const top = o.y - (pinH + label.lines.length * lineH) / 2;
    if (o.pin) {
      out.push(
        `<circle cx="${o.x}" cy="${top + 9}" r="8" fill="none" stroke="${ln}"/>`,
      );
      out.push(`<circle cx="${o.x}" cy="${top + 9}" r="4" fill="${pal}"/>`);
    }
    label.lines.forEach((line, i) => {
      const y = top + pinH + lineH * (i + 0.5);
      out.push(
        `<text x="${o.x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${name ? FONT : MONO}" font-size="${label.size}" letter-spacing="${label.size * (name ? 0.04 : 0.12)}" fill="${th.text}">${esc(fitText(line, o.w - 16, label.size))}</text>`,
      );
    });
  }
  // 文字
  for (const o of objs) {
    if (o.kind !== "text") continue;
    const pal = paletteOf(shownColorOf(o)).fill;
    out.push(
      `<text x="${o.x}" y="${o.y}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${o.size}" letter-spacing="1" fill="${mix(pal, th.text, 35)}">${esc(o.title || "")}</text>`,
    );
  }

  const vb = { x: box.x, y: box.y - head, w: box.w, h: box.h + head };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${vb.w}" height="${vb.h}">${out.join("")}</svg>`;
  return { svg, width: vb.w, height: vb.h };
}

/** SVG を PNG（Blob）にする。scale＝解像度の倍率 */
export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  const img = new Image();
  img.decoding = "async";
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("svg"));
    img.src = url;
  });
  // 大きすぎるとブラウザが描けないので、長い辺を 8000px までにする
  const k = Math.min(scale, 8000 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * k);
  canvas.height = Math.round(height * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("png"))),
      "image/png",
    ),
  );
}
