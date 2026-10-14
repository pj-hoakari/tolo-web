import { initializeApp } from "firebase/app";
import { addDoc, collection, getFirestore } from "firebase/firestore";
import { describe, expect, it, vi } from "vitest";
import { createFirestoreSignalingChannel } from "./signalingChannel";

vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  addDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: () => "server-timestamp",
}));

const db = getFirestore(
  initializeApp({ projectId: "signaling-test" }, "signaling-test"),
);

describe("Firestore のシグナリングチャネル", () => {
  it("管理 UI は console として from・payload・createdAt だけを書く", () => {
    const signalsRef = collection(db, "signals");
    const channel = createFirestoreSignalingChannel({
      signalsRef,
      self: "console",
    });

    channel.send({ kind: "candidate", candidate: null });

    expect(addDoc).toHaveBeenCalledWith(signalsRef, {
      from: "console",
      payload: { kind: "candidate", candidate: null },
      createdAt: "server-timestamp",
    });
  });
});
