// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EdgeDevice } from "@/server/router";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { useObservationPointSource } from "./useObservationPointSource";

const devices = vi.hoisted((): EdgeDevice[] => [
  {
    edgeDeviceId: "aaaaaaaaaaaaaaaa",
    name: "入口カメラ",
    online: true,
    lastHeartbeatAt: "2026-06-14T10:00:00.000Z",
    observationPoints: [
      { observationPointId: "1111111111111111", name: "入口" },
      { observationPointId: "2222222222222222", name: "" },
    ],
  },
  {
    edgeDeviceId: "bbbbbbbbbbbbbbbb",
    name: "ホールカメラ",
    online: false,
    lastHeartbeatAt: "2026-06-14T09:00:00.000Z",
    observationPoints: [
      { observationPointId: "3333333333333333", name: "ホール" },
    ],
  },
]);

vi.mock("@/lib/orpc", () => ({
  orpc: {
    observation: {
      listEdgeDevices: () => Promise.resolve({ devices }),
    },
  },
}));

afterEach(cleanup);

describe("useObservationPointSource", () => {
  it("稼働中のエッジ端末の観測点だけを観測点 ID で選択肢にする", async () => {
    const { result } = renderHook(
      () =>
        useObservationPointSource({
          eventId: "test",
          graph: { nodes: [], edges: [] },
        }),
      { wrapper: IntlTestProvider },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.available).toEqual([
      { observationPointId: "1111111111111111", name: "入口" },
      { observationPointId: "2222222222222222", name: "" },
    ]);
  });
});
