export const ACCEPT_ERRORS = [
  "unusable",
  "cannotJoin",
  "notFound",
  "failed",
] as const;

export type AcceptError = (typeof ACCEPT_ERRORS)[number];
