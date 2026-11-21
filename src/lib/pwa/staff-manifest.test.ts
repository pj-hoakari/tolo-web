import { describe, expect, it } from "vitest";
import { createManifest } from "./manifest";
import { createStaffManifest, getStaffPwaMetadata } from "./staff-manifest";

describe("staff manifest", () => {
  it("launches the existing authenticated entry without sharing the guest installation identity", () => {
    const staff = createStaffManifest();
    expect(staff.start_url).toBe("/management");
    expect(staff.id).toBe("/management");
    expect(staff.id).not.toBe(createManifest().id);
    expect(staff.scope).toBe("/");
    expect(staff.icons).toEqual(createManifest().icons);
    expect(getStaffPwaMetadata().manifest).toBe(
      "/manifest.webmanifest?audience=staff",
    );
  });
});
