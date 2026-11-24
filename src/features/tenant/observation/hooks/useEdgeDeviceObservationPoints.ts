import { ORPCError } from "@orpc/client";
import { useCallback, useEffect, useState } from "react";
import { orpc } from "@/lib/orpc";
import type { ObservationPoint } from "@/server/router";

const hasCode = (cause: unknown, code: string) =>
  cause instanceof ORPCError && cause.code === code;

export type EdgeDeviceObservationPoints = {
  points: readonly ObservationPoint[] | null;
  unregistered: boolean;
  add: (name: string) => Promise<ObservationPoint>;
};

export function useEdgeDeviceObservationPoints({
  enabled = true,
  eventId,
  edgeDeviceId,
}: {
  enabled?: boolean;
  eventId: string;
  edgeDeviceId: string;
}): EdgeDeviceObservationPoints {
  const [points, setPoints] = useState<readonly ObservationPoint[] | null>(
    null,
  );
  const [unregistered, setUnregistered] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    orpc.observation
      .listObservationPoints({ eventId, edgeDeviceId })
      .then(({ observationPoints }) => {
        if (!cancelled) setPoints(observationPoints);
      })
      .catch((cause: unknown) => {
        console.error("failed to load observation points", cause);
        if (!cancelled && hasCode(cause, "PRECONDITION_FAILED")) {
          setUnregistered(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, eventId, edgeDeviceId]);

  const add = useCallback(
    async (name: string): Promise<ObservationPoint> => {
      try {
        const { point } = await orpc.observation.addObservationPoint({
          eventId,
          edgeDeviceId,
          name,
        });
        setPoints((current) => [
          ...(current ?? []).filter(
            (p) => p.observationPointId !== point.observationPointId,
          ),
          point,
        ]);
        return point;
      } catch (cause) {
        if (hasCode(cause, "PRECONDITION_FAILED")) {
          setUnregistered(true);
        }
        if (!hasCode(cause, "CONFLICT")) throw cause;
        const { observationPoints } =
          await orpc.observation.listObservationPoints({
            eventId,
            edgeDeviceId,
          });
        setPoints(observationPoints);
        const existing = observationPoints.find((p) => p.name === name.trim());
        if (!existing) throw cause;
        return existing;
      }
    },
    [eventId, edgeDeviceId],
  );

  return { points, unregistered, add };
}
