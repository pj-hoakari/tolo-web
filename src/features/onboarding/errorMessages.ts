import type { ErrorMessageKeys } from "@/lib/errorMessageKey";

export const ONBOARDING_ERRORS = [
  "subdomainTaken",
  "invalid",
  "failed",
] as const;

export type OnboardingError = (typeof ONBOARDING_ERRORS)[number];

export const REGISTER_TENANT_ERROR_MESSAGES = {
  byCode: {
    CONFLICT: "subdomainTaken",
    BAD_REQUEST: "invalid",
  },
  fallback: "failed",
} as const satisfies ErrorMessageKeys<OnboardingError>;
