import type { CollectionReference } from "firebase/firestore";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDocsMock = vi.fn();

vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  addDoc: vi.fn(() => Promise.resolve()),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

const { createFirestorePollingSignalingChannel } = await import(
  "./signalingChannel"
);

const signalsRef = {} as CollectionReference;

function snapshot(
  docs: Array<{ id: string; from: "edge" | "console"; payload: unknown }>,
) {
  return {
    docs: docs.map((doc) => ({
      id: doc.id,
      data: () => ({ from: doc.from, payload: doc.payload }),
    })),
  };
}

describe("Firestore のポーリングシグナリングチャネル", () => {
  afterEach(() => {
    getDocsMock.mockReset();
    vi.useRealTimers();
  });

  it("未処理の相手メッセージだけを順に通知する", async () => {
    vi.useFakeTimers();
    const messages: unknown[] = [];
    getDocsMock
      .mockResolvedValueOnce(
        snapshot([
          { id: "self-1", from: "console", payload: { ignored: true } },
          { id: "other-1", from: "edge", payload: { kind: "answer" } },
        ]),
      )
      .mockResolvedValueOnce(
        snapshot([
          { id: "self-1", from: "console", payload: { ignored: true } },
          { id: "other-1", from: "edge", payload: { kind: "answer" } },
          { id: "other-2", from: "edge", payload: { kind: "candidate" } },
        ]),
      );

    const channel = createFirestorePollingSignalingChannel({
      signalsRef,
      self: "console",
      intervalMs: 100,
    });
    const stop = channel.listen((message) => messages.push(message));

    await vi.advanceTimersByTimeAsync(0);
    expect(messages).toEqual([{ kind: "answer" }]);

    await vi.advanceTimersByTimeAsync(100);
    expect(messages).toEqual([{ kind: "answer" }, { kind: "candidate" }]);

    stop();
    await vi.advanceTimersByTimeAsync(500);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });
});
