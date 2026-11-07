import { createHash } from "node:crypto";
import { getRealAuth } from "./betterAuth";
import { PENDING_MACHINE_HANDOFF } from "./machineSession";

type PendingHandoff = {
  eventId: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export async function pendingMachineHandoffEvent(
  code: string,
): Promise<string | undefined> {
  if (!process.env.AUTH_DATABASE_URL) return undefined;
  const { auth } = getRealAuth();
  const { adapter } = await auth.$context;
  const handoff = await adapter.findOne<PendingHandoff>({
    model: PENDING_MACHINE_HANDOFF,
    where: [{ field: "codeHash", value: sha256(code) }],
  });
  return handoff?.eventId;
}
