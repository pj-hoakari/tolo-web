// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sampleEdgeDevicesWire } from "@/mocks/fixtures/edges";
import { edgesHandlers } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { useEdgeDevices } from "./useEdgeDevices";

const [entrance, booth, hall] = sampleEdgeDevicesWire;

const renderEdges = () =>
  renderHook(() => useEdgeDevices({ eventId: "e", intervalMs: 60_000 }), {
    wrapper: IntlTestProvider,
  });

const summary = (edges: ReturnType<typeof useEdgeDevices>["edges"]) =>
  edges.map(({ edgeDeviceId, online }) => ({ edgeDeviceId, online }));

describe("useEdgeDevices", () => {
  it("オフラインの端末も、オンラインの端末の後に返す", async () => {
    server.use(...edgesHandlers([hall, entrance, booth]));
    const { result } = renderEdges();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(summary(result.current.edges)).toEqual([
      { edgeDeviceId: entrance.edgeDeviceId, online: true },
      { edgeDeviceId: booth.edgeDeviceId, online: true },
      { edgeDeviceId: hall.edgeDeviceId, online: false },
    ]);
  });

  it("端末がオフラインになっても一覧に残す", async () => {
    server.use(...edgesHandlers([entrance]));
    const { result } = renderEdges();
    await waitFor(() => expect(result.current.edges).toHaveLength(1));

    server.use(...edgesHandlers([{ ...entrance, online: false }]));
    act(() => result.current.refresh());

    await waitFor(() =>
      expect(summary(result.current.edges)).toEqual([
        { edgeDeviceId: entrance.edgeDeviceId, online: false },
      ]),
    );
  });
});
