import { describe, expect, it } from "vitest";
import { detectWebSerialAvailability } from "./transport";

describe("detectWebSerialAvailability", () => {
  it("reports unsupported when the browser has no Web Serial API", () => {
    expect(
      detectWebSerialAvailability({ serial: undefined, isSecureContext: true }),
    ).toBe("unsupported");
  });

  it("reports insecure when Web Serial exists outside a secure context", () => {
    expect(
      detectWebSerialAvailability({ serial: {}, isSecureContext: false }),
    ).toBe("insecure");
  });

  it("reports available when Web Serial exists in a secure context", () => {
    expect(
      detectWebSerialAvailability({ serial: {}, isSecureContext: true }),
    ).toBe("available");
  });
});
