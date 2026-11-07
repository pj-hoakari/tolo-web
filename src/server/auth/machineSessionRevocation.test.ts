import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./betterAuth", () => ({
  getRealAuth: vi.fn(),
}));

import { getRealAuth } from "./betterAuth";
import {
  revokeMachineSessionsForEdge,
  revokeMachineSessionsForEvent,
} from "./machineSessionRevocation";

describe("machine session revocation", () => {
  const deletedSessions: string[] = [];
  const deletedModels: { model: string; where: unknown }[] = [];

  beforeEach(() => {
    process.env.AUTH_DATABASE_URL = "postgres://unused";
    deletedSessions.length = 0;
    deletedModels.length = 0;
    vi.mocked(getRealAuth).mockReturnValue({
      auth: {
        $context: Promise.resolve({
          adapter: {
            findMany: vi.fn(async () => [
              { id: "machine-1", token: "token-1" },
              { id: "machine-2", token: "token-2" },
            ]),
            deleteMany: vi.fn(async (args) => {
              deletedModels.push(args);
            }),
          },
          internalAdapter: {
            deleteSession: vi.fn(async (token: string) => {
              deletedSessions.push(token);
            }),
          },
        }),
      },
    } as never);
  });

  afterEach(() => {
    process.env.AUTH_DATABASE_URL = undefined;
    vi.clearAllMocks();
  });

  it("deletes machine sessions, tokens, and pending event handoffs", async () => {
    await revokeMachineSessionsForEvent("event-1");

    expect(deletedSessions).toEqual(["token-1", "token-2"]);
    const models = deletedModels.map((entry) => entry.model);
    expect(models).toEqual(
      expect.arrayContaining([
        "eventAccessToken",
        "tenantAccessToken",
        "pendingMachineHandoff",
        "pendingMachineAuthorization",
      ]),
    );
    expect(
      models.filter((model) => model === "tenantAccessToken"),
    ).toHaveLength(2);
  });

  it("scopes page removal to the edge device", async () => {
    await revokeMachineSessionsForEdge("event-1", "edge-1");

    expect(deletedModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: "pendingMachineHandoff",
          where: expect.arrayContaining([
            { field: "eventId", value: "event-1" },
            { field: "edgeDeviceId", value: "edge-1" },
          ]),
        }),
        expect.objectContaining({
          model: "pendingMachineAuthorization",
          where: expect.arrayContaining([
            { field: "eventId", value: "event-1" },
            { field: "pageEdgeDeviceId", value: "edge-1" },
          ]),
        }),
      ]),
    );
  });
});
