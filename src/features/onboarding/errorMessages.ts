import type { ErrorMessageKeys } from "@/lib/errorMessageKey";

export const REGISTER_TENANT_ERROR_MESSAGES = {
  byCode: {
    CONFLICT: "subdomainTaken",
    BAD_REQUEST: "invalid",
  },
  fallback: "failed",
} as const satisfies ErrorMessageKeys<string>;
