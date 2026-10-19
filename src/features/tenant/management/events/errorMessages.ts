import type { ErrorMessageKeys } from "@/lib/errorMessageKey";

const TRANSITION_ERRORS = {
  PRECONDITION_FAILED: "transition.stale",
  NOT_FOUND: "transition.eventNotFound",
} as const;

export const EVENT_ERROR_MESSAGES = {
  create: {
    byCode: {
      PRECONDITION_FAILED: "create.tenantUnavailable",
      NOT_FOUND: "create.tenantNotFound",
    },
    fallback: "create.failed",
  },
  archive: { byCode: TRANSITION_ERRORS, fallback: "archive.failed" },
  restore: { byCode: TRANSITION_ERRORS, fallback: "restore.failed" },
} as const satisfies Record<string, ErrorMessageKeys<string>>;
