import { create } from "@bufbuild/protobuf";
import {
  createClient,
  createContextValues,
  createRouterTransport,
} from "@connectrpc/connect";
import {
  IssueFirestoreTokenResponseSchema,
  SignalingService,
} from "@pj-hoakari/tolo-edge-bridge-client-es/tolo/edgebridge/v1/signaling_pb";
import {
  GetGraphResponseSchema,
  GraphAuthoringService,
} from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventAccess, eventIdKey, tenantAccess } from "./authorize";

vi.mock("server-only", () => ({}));

function recordingTransport(interceptor: typeof tenantAccess) {
  const authorization = vi.fn<(value: string | null) => void>();
  const transport = createRouterTransport(
    (router) => {
      router.service(GraphAuthoringService, {
        getGraph: (_, ctx) => {
          authorization(ctx.requestHeader.get("Authorization"));
          return create(GetGraphResponseSchema);
        },
      });
      router.service(SignalingService, {
        issueFirestoreToken: (_, ctx) => {
          authorization(ctx.requestHeader.get("Authorization"));
          return create(IssueFirestoreTokenResponseSchema);
        },
      });
    },
    { transport: { interceptors: [interceptor] } },
  );
  return { transport, authorization };
}

describe("Gateway client interceptors", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_MOCKING", "enabled");
    vi.stubEnv("ROOT_DOMAIN", "");
    vi.stubEnv("TENANT_ACCESS_TOKEN", "tenant-token");
    vi.stubEnv("GRAPH_ACCESS_TOKEN", "graph-token");
    vi.stubEnv("OBSERVATION_ACCESS_TOKEN", "observation-token");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends the tenant access token", async () => {
    const { transport, authorization } = recordingTransport(tenantAccess);

    await createClient(GraphAuthoringService, transport).getGraph({});

    expect(authorization).toHaveBeenCalledWith("Bearer tenant-token");
  });

  it("sends the event access token for the eventId in the request message", async () => {
    const { transport, authorization } = recordingTransport(
      eventAccess("console"),
    );

    await createClient(GraphAuthoringService, transport).getGraph({
      eventId: "e1",
    });

    expect(authorization).toHaveBeenCalledWith("Bearer graph-token");
  });

  it("sends the event access token for the eventId in the call context", async () => {
    const { transport, authorization } = recordingTransport(
      eventAccess("edge"),
    );

    await createClient(SignalingService, transport).issueFirestoreToken(
      {},
      { contextValues: createContextValues().set(eventIdKey, "e1") },
    );

    expect(authorization).toHaveBeenCalledWith("Bearer observation-token");
  });

  it("does not send an event-scoped call without an eventId", async () => {
    const { transport, authorization } = recordingTransport(
      eventAccess("edge"),
    );

    await expect(
      createClient(SignalingService, transport).issueFirestoreToken({}),
    ).rejects.toThrow();
    expect(authorization).not.toHaveBeenCalled();
  });
});
