import { signInWithCustomToken } from "firebase/auth";
import type { FirestoreToken } from "@/server/router";
import { getAuth } from "./firebase";

export const REFRESH_MARGIN_MS = 60_000;
export const RETRY_DELAY_MS = 10_000;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export async function signInForSignaling(
  issueToken: () => Promise<FirestoreToken>,
): Promise<() => void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const signIn = async (): Promise<void> => {
    const { customToken, expiresAt } = await issueToken();
    if (stopped) return;
    await signInWithCustomToken(getAuth(), customToken);
    const delay = expiresAt.getTime() - REFRESH_MARGIN_MS - Date.now();
    if (delay > 0) schedule(delay, expiresAt);
  };

  const schedule = (delay: number, expiresAt: Date) => {
    if (stopped) return;
    timer = setTimeout(
      () => {
        signIn().catch((e) => {
          console.error("[firestore-sign-in] refresh", e);
          if (Date.now() + RETRY_DELAY_MS < expiresAt.getTime()) {
            schedule(RETRY_DELAY_MS, expiresAt);
          }
        });
      },
      Math.min(delay, MAX_TIMEOUT_MS),
    );
  };

  await signIn();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
