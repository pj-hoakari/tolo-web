import { type Auth, signInWithCustomToken } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REFRESH_MARGIN_MS,
  RETRY_DELAY_MS,
  signInForSignaling,
} from "./firestoreSignIn";

vi.mock("firebase/auth", () => ({
  signInWithCustomToken: vi.fn(() => Promise.resolve()),
}));

const HOUR = 60 * 60 * 1000;
const auth = {} as Auth;

describe("シグナリング用のサインイン", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
    vi.mocked(signInWithCustomToken).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("発行されたカスタムトークンでサインインする", async () => {
    await signInForSignaling(
      async () => ({
        customToken: "token-1",
        expiresAt: new Date(HOUR),
      }),
      auth,
    );

    expect(signInWithCustomToken).toHaveBeenCalledWith(auth, "token-1");
  });

  it("expiresAt の手前でトークンを取り直してサインインし直す", async () => {
    const issue = vi
      .fn()
      .mockResolvedValueOnce({
        customToken: "token-1",
        expiresAt: new Date(HOUR),
      })
      .mockResolvedValue({
        customToken: "token-2",
        expiresAt: new Date(2 * HOUR),
      });
    await signInForSignaling(issue, auth);

    await vi.advanceTimersByTimeAsync(HOUR - REFRESH_MARGIN_MS - 1);
    expect(signInWithCustomToken).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(signInWithCustomToken).toHaveBeenLastCalledWith(auth, "token-2");

    await vi.advanceTimersByTimeAsync(HOUR);
    expect(signInWithCustomToken).toHaveBeenCalledTimes(3);
  });

  it("取り直しても期限が延びなければそれ以上取り直さない", async () => {
    const issue = vi
      .fn()
      .mockResolvedValue({ customToken: "token", expiresAt: new Date(HOUR) });
    await signInForSignaling(issue, auth);

    await vi.advanceTimersByTimeAsync(2 * HOUR);

    expect(issue).toHaveBeenCalledTimes(2);
  });

  it("取り直しに失敗したら期限までやり直す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const issue = vi
      .fn()
      .mockResolvedValueOnce({
        customToken: "token-1",
        expiresAt: new Date(HOUR),
      })
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValue({
        customToken: "token-2",
        expiresAt: new Date(2 * HOUR),
      });
    await signInForSignaling(issue, auth);

    await vi.advanceTimersByTimeAsync(HOUR - REFRESH_MARGIN_MS);
    expect(signInWithCustomToken).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(signInWithCustomToken).toHaveBeenLastCalledWith(auth, "token-2");
  });

  it("止めたあとは取り直さない", async () => {
    const issue = vi
      .fn()
      .mockResolvedValue({ customToken: "token", expiresAt: new Date(HOUR) });
    const stop = await signInForSignaling(issue, auth);

    stop();
    await vi.advanceTimersByTimeAsync(2 * HOUR);

    expect(issue).toHaveBeenCalledTimes(1);
  });
});
