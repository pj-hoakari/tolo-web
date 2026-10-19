import { ORPCError } from "@orpc/client";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { orpc } from "@/lib/orpc";
import { type GraphViolation, graphViolationsSchema } from "./graphDataSchema";

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
      const details = graphViolationsSchema.safeParse(error.data);
      if (details.success && details.data.violations.length > 0) {
        throw new GraphValidationError(details.data.violations);
      }
    }
    throw error;
  }
}

export class GraphValidationError extends Error {
  readonly violations: GraphViolation[];

  constructor(violations: GraphViolation[]) {
    super();
    this.name = "GraphValidationError";
    this.violations = violations;
  }
}
