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

  it("preserves the existing key format for a valid scope", () => {
    expect(scopeStaffStorageKey("settings", "guild-123")).toBe(
      "tolo:staff:guild-123:settings",
    );
    expect(scopeStaffStorageKey("settings", " guild-123 ")).toBe(
      "tolo:staff: guild-123 :settings",
    );
  });

  it("requires a scope at compile time and at runtime", () => {
    expect(() => {
      // @ts-expect-error A scope is required even for legacy keys.
      scopeStaffStorageKey("settings");
    }).toThrow("scopeStaffStorageKey: valid scope is required");
  });

  it.each(["", " \t\n", undefined, null])("rejects scope %j", (scope) => {
    expect(() =>
      Reflect.apply(scopeStaffStorageKey, undefined, ["settings", scope]),
    ).toThrow("scopeStaffStorageKey: valid scope is required");
  });
});
