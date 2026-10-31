import { describe, expect, it } from "vitest";
import { isAuthMockingAllowed } from "./mocking";

describe("isAuthMockingAllowed", () => {
  it.each([
    ["localhost", undefined],
    ["test.localhost", undefined],
    ["tolo.mercuryksm.net", "tolo.mercuryksm.net"],
    ["s3.tolo.mercuryksm.net", " other.example , Tolo.MercuryKSM.net "],
  ])("allows %s with allowlist %j", (rootDomain, allowlist) => {
    expect(isAuthMockingAllowed(rootDomain, allowlist)).toBe(true);
  });

  it.each([
    ["example.com", "tolo.mercuryksm.net"],
    ["eviltolo.mercuryksm.net", "tolo.mercuryksm.net"],
    ["localhost.example.com", undefined],
    ["tolo.mercuryksm.net", undefined],
    ["tolo.mercuryksm.net", ""],
    ["tolo.mercuryksm.net", " , "],
  ])("refuses %s with allowlist %j", (rootDomain, allowlist) => {
    expect(isAuthMockingAllowed(rootDomain, allowlist)).toBe(false);
  });
});
