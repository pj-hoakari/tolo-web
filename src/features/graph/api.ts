import { ORPCError } from "@orpc/client";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { orpc } from "@/lib/orpc";

/** グラフを特定するためのキー。tenant / guest のどちらからも同じ値で引く */
export type GraphKey = {
  tenantId: string;
  eventId: string;
};

export async function fetchGraph({ eventId }: GraphKey): Promise<GraphData> {
  return orpc.graph.getGraph({ eventId });
}

export async function saveGraph(
  { eventId }: GraphKey,
  graph: GraphData,
): Promise<void> {
  try {
    await orpc.graph.saveGraph({ eventId, graph });
  } catch (error) {
    if (error instanceof ORPCError && error.code === "BAD_REQUEST") {
      throw new GraphValidationError(error.message);
    }
    throw error;
  }
}

export type GraphValidationTarget = { type: "node" | "edge"; id: string };

const TARGET_TYPES: Record<string, GraphValidationTarget["type"]> = {
  node: "node",
  point: "node",
  group: "node",
  edge: "edge",
};

export function validationTarget(
  message: string,
): GraphValidationTarget | null {
  const match = /\b(node|point|group|edge) "([^"]+)"/.exec(message);
  return match ? { type: TARGET_TYPES[match[1]], id: match[2] } : null;
}

export class GraphValidationError extends Error {
  readonly target = validationTarget(this.message);

  constructor(message: string) {
    super(message);
    this.name = "GraphValidationError";
  }
}
