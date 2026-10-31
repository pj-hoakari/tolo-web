import { cookies } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import {
  forgetInvitation,
  openInvitation,
  pendingInvitationToken,
} from "./invitation";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const open = (search: string) =>
  openInvitation(
    new Request(
      `http://acme.localhost:3000/tenant/0123456789abcdef/invitation${search}`,
    ),
  );

describe("openInvitation", () => {
  it("moves the invitation token into a host-only HttpOnly cookie and redirects to a URL without it, sending no referrer", () => {
    const response = open("?token=tok_ABC-123");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/invitation/accept");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toBe(
      "__Host-tolo.invitation=tok_ABC-123; Max-Age=1800; Path=/; HttpOnly; Secure; SameSite=Lax",
    );
  });

  it.each([
    ["no token", ""],
    ["a token that is not URL-safe base64", "?token=a%3Bb"],
  ])(
    "keeps nothing for %s and still redirects without the query",
    (_, search) => {
      const response = open(search);

      expect(response.headers.get("location")).toBe("/invitation/accept");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );
});

describe("the pending invitation", () => {
  it("reads the kept token and ignores a tampered one", async () => {
    const get = vi.fn().mockReturnValueOnce({ value: "tok_ABC-123" });
    get.mockReturnValueOnce({ value: "a;b" });
    vi.mocked(cookies).mockResolvedValue({ get } as never);

    await expect(pendingInvitationToken()).resolves.toBe("tok_ABC-123");
    await expect(pendingInvitationToken()).resolves.toBeUndefined();
  });

  it("is forgotten with the same host-only attributes so the browser drops it", async () => {
    const set = vi.fn();
    vi.mocked(cookies).mockResolvedValue({ set } as never);

    await forgetInvitation();

    expect(set).toHaveBeenCalledWith("__Host-tolo.invitation", "", {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 0,
    });
  });
});
