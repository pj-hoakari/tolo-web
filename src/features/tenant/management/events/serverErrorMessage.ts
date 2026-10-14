import { ORPCError } from "@orpc/client";

const CODES_WITH_SERVER_MESSAGE = new Set([
  "BAD_REQUEST",
  "PRECONDITION_FAILED",
  "NOT_FOUND",
]);

export function serverErrorMessage(error: unknown): string | null {
  return error instanceof ORPCError && CODES_WITH_SERVER_MESSAGE.has(error.code)
    ? error.message
    : null;
}
