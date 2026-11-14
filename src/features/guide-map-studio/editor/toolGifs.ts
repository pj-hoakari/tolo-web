// 道具の説明カードに出す動き（GIF）。assets/ に置き、import して使う
// （import すると /_next/static/media/ から配られる。public/ だと .gif がテナントのページの道として扱われて届かないため）。
import type { StaticImageData } from "next/image";
import area from "./assets/area.gif";
import circle from "./assets/circle.gif";
import connector from "./assets/connector.gif";
import pin from "./assets/pin.gif";
import rect from "./assets/rect.gif";
import select from "./assets/select.gif";
import text from "./assets/text.gif";
import type { Tool } from "./shared";

export const TOOL_GIFS: Record<Tool, StaticImageData> = {
  select,
  rect,
  circle,
  pin,
  area,
  text,
  connector,
};
