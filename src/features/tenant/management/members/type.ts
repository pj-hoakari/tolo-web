export type TenantRole = "owner" | "staff";

export interface EventRoleAssignment {
  eventId: string;
  role: TenantRole;
}

export interface TenantMember {
  userId: string;
  displayName: string;
  role: TenantRole;
  joinedAt: string | null;
  eventRoles: EventRoleAssignment[];
}

export interface TenantInvitation {
  invitationId: string;
  displayName: string;
  expiresAt: string | null;
}

export interface CreatedInvitation {
  invitation: TenantInvitation;
  invitationToken: string;
}
