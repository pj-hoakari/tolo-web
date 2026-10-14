import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { sessionDoc, sessionsCollection } from "./refs";

const db = getFirestore(initializeApp({ projectId: "refs-test" }, "refs-test"));

describe("シグナリングの参照", () => {
  it("セッション一覧はテナント・イベント・エッジデバイスの下にある", () => {
    expect(sessionsCollection(db, "t1", "e1", "d1").path).toBe(
      "tenants/t1/events/e1/edgeDevices/d1/sessions",
    );
  });

  it("セッションはテナント・イベント・エッジデバイスの下にある", () => {
    expect(sessionDoc(db, "t1", "e1", "d1", "s1").path).toBe(
      "tenants/t1/events/e1/edgeDevices/d1/sessions/s1",
    );
  });
});
