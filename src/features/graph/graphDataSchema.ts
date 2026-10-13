import { z } from "zod";
import type { GraphData } from "@/features/tenant/management/graph/type";

const coordinate = z.number().finite();
const position = z.object({ x: coordinate, y: coordinate });
const labels = z.record(z.string(), z.string());
const observationPointIds = z.array(z.string()).optional();

const pointNode = z.object({
  id: z.string().min(1),
  type: z.literal("graph"),
  position,
  parentId: z.string().min(1).optional(),
  data: z.object({
    labels,
    nodeType: z.enum([
      "GOAL",
      "GOAL_TRANSIT_MIXED",
      "TRANSIT_ONLY",
      "EXTERNAL",
    ]),
    observationPointIds,
  }),
});

const groupNode = z.object({
  id: z.string().min(1),
  type: z.literal("graphGroup"),
  position,
  parentId: z.string().min(1).optional(),
  width: coordinate,
  height: coordinate,
  data: z.object({
    labels,
    minWidth: coordinate.optional(),
    minHeight: coordinate.optional(),
  }),
});

const edge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.literal("graph"),
  data: z.object({
    direction: z.enum(["both", "oneway"]),
    label: z.string().optional(),
    observationPointIds,
  }),
});

export const graphDataSchema: z.ZodType<GraphData> = z.object({
  nodes: z.array(z.discriminatedUnion("type", [pointNode, groupNode])),
  edges: z.array(edge),
});
