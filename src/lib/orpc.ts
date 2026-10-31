import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import type { RouterClient } from "@orpc/server";
import type { router } from "@/server/router";

const link = new RPCLink({
  url:
    typeof window !== "undefined"
      ? `${window.location.origin}/rpc`
      : "http://localhost:3000/rpc",
  plugins: [new SimpleCsrfProtectionLinkPlugin()],
});

export const orpc: RouterClient<typeof router> = createORPCClient(link);
