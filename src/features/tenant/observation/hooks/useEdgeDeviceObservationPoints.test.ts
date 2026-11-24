// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useEdgeDeviceObservationPoints } from "./useEdgeDeviceObservationPoints";

const listObservationPoints = vi.hoisted(() => vi.fn());
const addObservationPoint = vi.hoisted(() => vi.fn());

vi.mock("@/lib/orpc", () => ({
  orpc: { observation: { listObservationPoints, addObservationPoint } },
}));

const ENTRANCE = { observationPointId: "a1b2c3d4e5f60718", name: "入口" };
const EXIT = { observationPointId: "b1b2c3d4e5f60718", name: "出口" };

beforeEach(() => {
  listObservationPoints.mockReset();
  addObservationPoint.mockReset();
});

function renderPoints() {
  return renderHook(() =>
    useEdgeDeviceObservationPoints({
      eventId: "event",
      edgeDeviceId: "0123456789abcdef",
    }),
  );
}

it("adds the new observation point to the device's points", async () => {
  listObservationPoints.mockResolvedValue({ observationPoints: [ENTRANCE] });
  addObservationPoint.mockResolvedValue({ point: EXIT });
  const { result } = renderPoints();
  await waitFor(() => expect(result.current.points).toEqual([ENTRANCE]));

  await act(async () => {
    await expect(result.current.add("出口")).resolves.toEqual(EXIT);
  });

  expect(addObservationPoint).toHaveBeenCalledWith({
    eventId: "event",
    edgeDeviceId: "0123456789abcdef",
    name: "出口",
  });
  expect(result.current.points).toEqual([ENTRANCE, EXIT]);
});

it("returns the existing point when another client already added the name", async () => {
  listObservationPoints
    .mockResolvedValueOnce({ observationPoints: [] })
    .mockResolvedValueOnce({ observationPoints: [EXIT] });
  addObservationPoint.mockRejectedValue(new ORPCError("CONFLICT"));
  const { result } = renderPoints();
  await waitFor(() => expect(result.current.points).toEqual([]));

  await act(async () => {
    await expect(result.current.add(" 出口 ")).resolves.toEqual(EXIT);
  });

  expect(result.current.points).toEqual([EXIT]);
});

it("reports an unregistered device", async () => {
  listObservationPoints.mockRejectedValue(new ORPCError("PRECONDITION_FAILED"));
  const { result } = renderPoints();

  await waitFor(() => expect(result.current.unregistered).toBe(true));
  expect(result.current.points).toBeNull();
});
