import { type CommonORPCErrorCode, ORPCError } from "@orpc/client";

export type ErrorMessageKeys<K extends string> = {
  byCode: Partial<Record<CommonORPCErrorCode, K>>;
  fallback: K;
};

export function errorMessageKey<K extends string>(
  error: unknown,
  { byCode, fallback }: ErrorMessageKeys<K>,
): K {
  const key =
    error instanceof ORPCError
      ? byCode[error.code as CommonORPCErrorCode]
      : undefined;
  return key ?? fallback;
}
