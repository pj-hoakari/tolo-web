import { signInWithCustomToken } from "firebase/auth";
import type { FirestoreToken } from "@/server/router";
import { getAuth } from "./firebase";

export const REFRESH_MARGIN_MS = 60_000;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export async function signInForSignaling(
  issueToken: () => Promise<FirestoreToken>,
): Promise<() => void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const signIn = async () => {
    const { customToken, expiresAt } = await issueToken();
    if (stopped) return;
    await signInWithCustomToken(getAuth(), customToken);
    const delay = expiresAt.getTime() - REFRESH_MARGIN_MS - Date.now();
    if (stopped || delay <= 0) return;
    timer = setTimeout(
      () => {
        signIn().catch((e) => console.error("[firestore-sign-in] refresh", e));
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
