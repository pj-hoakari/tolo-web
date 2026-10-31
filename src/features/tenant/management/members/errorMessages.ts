import type { ErrorMessageKeys } from "@/lib/errorMessageKey";

export const MEMBER_ERROR_MESSAGES = {
  promote: {
    byCode: {
      PRECONDITION_FAILED: "errors.stale",
      NOT_FOUND: "errors.memberNotFound",
    },
    fallback: "actions.promote.failed",
  },
  demote: {
    byCode: {
      PRECONDITION_FAILED: "errors.lastOwner",
      NOT_FOUND: "errors.memberNotFound",
    },
    fallback: "actions.demote.failed",
  },
  remove: {
    byCode: {
      PRECONDITION_FAILED: "errors.lastOwner",
      NOT_FOUND: "errors.memberNotFound",
    },
    fallback: "actions.remove.failed",
  },
  createInvitation: {
    byCode: {
      BAD_REQUEST: "invite.invalid",
      PRECONDITION_FAILED: "errors.stale",
    },
    fallback: "invite.failed",
  },
  revokeInvitation: {
    byCode: { PRECONDITION_FAILED: "invitations.alreadyUsed" },
    fallback: "invitations.revokeFailed",
  },
} as const satisfies Record<string, ErrorMessageKeys<string>>;
