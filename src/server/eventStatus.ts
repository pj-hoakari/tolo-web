import { ORPCError } from "@orpc/server";
import { EventStatus as ProtoEventStatus } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";
import { requestTenantId } from "./auth";
import { tenantManagementClient } from "./tenantManagement";

const EVENT_STATUSES: Partial<Record<ProtoEventStatus, string>> = {
  [ProtoEventStatus.DRAFT]: "draft",
  [ProtoEventStatus.OPEN]: "open",
  [ProtoEventStatus.LOCKED]: "locked",
  [ProtoEventStatus.CLOSED]: "closed",
  [ProtoEventStatus.ARCHIVED]: "archived",
};

export async function requireApprovableEvent(eventId: string): Promise<void> {
  const tenantId = await requestTenantId();
  if (!tenantId) throw new ORPCError("UNAUTHORIZED");
  const response = await tenantManagementClient.listEvents({
    tenantId,
    includeArchived: true,
  });
  const event = response.events.find(
    (candidate) => candidate.eventId === eventId,
  );
  if (!event) throw new ORPCError("NOT_FOUND");
  const status = EVENT_STATUSES[event.status];
  if (status === "closed" || status === "archived") {
    throw new ORPCError("PRECONDITION_FAILED");
  }
}
