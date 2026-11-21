import { describe, expect, it } from "vitest";
import { createStaffStorageScope, scopeStaffStorageKey } from "./staff-storage";

describe("staff persistence ownership", () => {
  it("separates users, tenants and machine identities for the same event", () => {
    const owners = [
      createStaffStorageScope("tenant-a", { type: "staff", userId: "alice" }),
      createStaffStorageScope("tenant-a", { type: "staff", userId: "bob" }),
      createStaffStorageScope("tenant-b", { type: "staff", userId: "alice" }),
      createStaffStorageScope("tenant-a", { type: "machine", userId: "alice" }),
      createStaffStorageScope("tenant-a", { type: "anonymous" }),
    ];
    expect(new Set(owners).size).toBe(owners.length);
    expect(
      new Set(
        owners.map((scope) => scopeStaffStorageKey("event:device", scope)),
      ).size,
    ).toBe(owners.length);
  });

  it("does not confuse separator characters with a different identity", () => {
    expect(
      createStaffStorageScope("a:b", { type: "staff", userId: "c" }),
    ).not.toBe(createStaffStorageScope("a", { type: "staff", userId: "b:c" }));
  });

  it("leaves the legacy key available only for consumers without a session scope", () => {
    const legacy = "guide-map-studio:book:event";
    expect(scopeStaffStorageKey(legacy)).toBe(legacy);
    expect(scopeStaffStorageKey(legacy, "owner")).not.toBe(legacy);
  });
});
