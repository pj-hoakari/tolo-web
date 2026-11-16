import { z } from "zod";
import type { LocalizedGuideMapLayout } from "./guideMapLayout";

// 案内マップエディタから保存する案内マップ（LocalizedGuideMapLayout）の入力チェック

const coordinate = z.number().finite();
const point = z.object({ x: coordinate, y: coordinate });
const labels = z.record(z.string(), z.string());

const base = {
  id: z.string().min(1),
  groupId: z.string().min(1),
  title: labels.optional(),
  description: labels.optional(),
  photo: z.string().optional(),
  color: z.string(),
  closed: z.boolean().optional(),
  pointId: z.string().optional(),
  routeId: z.string().optional(),
};

const place = z.object({
  ...base,
  kind: z.literal("place"),
  x: coordinate,
  y: coordinate,
  shape: z.enum(["pin", "rect", "circle"]),
  w: coordinate,
  h: coordinate,
  pin: z.boolean().optional(),
  connector: z.enum(["stairs", "escalator", "elevator"]).optional(),
  link: z.string().optional(),
  direction: z.enum(["both", "up", "down"]).optional(),
  markW: coordinate.optional(),
  markH: coordinate.optional(),
  markerSize: coordinate.optional(),
});

const line = z.object({
  ...base,
  kind: z.literal("line"),
  points: z.array(point),
  width: coordinate,
  dash: z.boolean(),
});

const area = z.object({
  ...base,
  kind: z.literal("area"),
  points: z.array(point),
});

const text = z.object({
  ...base,
  kind: z.literal("text"),
  x: coordinate,
  y: coordinate,
  size: coordinate,
});

export const guideMapLayoutSchema: z.ZodType<LocalizedGuideMapLayout> =
  z.object({
    version: z.literal(1),
    groups: z.array(
      z.object({
        groupId: z.string().min(1),
        image: z
          .object({ src: z.string(), w: coordinate, h: coordinate })
          .optional(),
      }),
    ),
    objects: z.array(z.discriminatedUnion("kind", [place, line, area, text])),
    north: coordinate,
    scale: coordinate,
    startId: z.string().optional(),
  });
