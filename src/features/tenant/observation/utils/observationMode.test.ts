import { describe, expect, it } from "vitest";
import {
  readObservationMode,
  resolveContinuousKey,
  writeObservationMode,
} from "./observationMode";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("observation mode", () => {
  it("defaults to burst and persists per camera", () => {
    const storage = memoryStorage();
    expect(readObservationMode("a", storage)).toBe("burst");
    writeObservationMode("a", "continuous", storage);
    expect(readObservationMode("a", storage)).toBe("continuous");
    expect(readObservationMode("b", storage)).toBe("burst");
    writeObservationMode("a", "burst", storage);
    expect(readObservationMode("a", storage)).toBe("burst");
  });

  it("falls back to burst for unknown values and broken storage", () => {
    const storage = memoryStorage();
    storage.setItem("tolo:observation-mode:a", "garbage");
    expect(readObservationMode("a", storage)).toBe("burst");
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readObservationMode("a", broken)).toBe("burst");
    expect(() => writeObservationMode("a", "continuous", broken)).not.toThrow();
  });
});

describe("resolveContinuousKey", () => {
  const continuous = new Set(["c1", "c2"]);
  const isContinuous = (key: string) => continuous.has(key);

  it("prefers the selected continuous camera", () => {
    expect(resolveContinuousKey("c2", ["b", "c1", "c2"], isContinuous)).toBe(
      "c2",
    );
  });

  it("falls back to the first open continuous camera", () => {
    expect(resolveContinuousKey("b", ["b", "c1", "c2"], isContinuous)).toBe(
      "c1",
    );
    expect(resolveContinuousKey("c2", ["b", "c1"], isContinuous)).toBe("c1");
  });

  it("returns null when every open camera is burst", () => {
    expect(resolveContinuousKey("b", ["b"], isContinuous)).toBeNull();
    expect(resolveContinuousKey(null, [], isContinuous)).toBeNull();
  });
});
