import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { canReadTenantMembers } from "@/features/tenant/management/headerAccess";
import { getViewer, type Viewer } from "@/server/auth";
import ManagementLayout from "./layout";

vi.mock("@/server/auth", () => ({ getViewer: vi.fn() }));
vi.mock("@/features/tenant/management/headerAccess", () => ({
  canReadTenantMembers: vi.fn(),
}));
vi.mock("@/features/tenant/management/components/ManagementHeader", () => ({
  ManagementHeader: ({
    staff,
    members,
    logout,
  }: {
    staff: boolean;
    members: boolean;
    logout: boolean;
  }) => (
    <header data-staff={staff} data-members={members} data-logout={logout} />
  ),
}));
vi.mock("@/features/tenant/management/components/ManagementShell", () => ({
  ManagementShell: ({
    header,
    children,
  }: {
    header: ReactNode;
    children: ReactNode;
  }) => (
    <>
      {header}
      {children}
    </>
  ),
}));

const tenantId = "0123456789abcdef";
const staff: Viewer = { type: "staff", tenantId, userId: "staff" };
const machine: Viewer = {
  type: "machine",
  tenantId,
  userId: "machine",
  eventId: "0000000000000001",
  edgeDeviceId: "8c1f0e2a5d4b3c6e",
};

it.each([
  { viewer: staff, permitted: true, expected: [true, true, true] },
  { viewer: staff, permitted: false, expected: [true, false, true] },
  { viewer: machine, permitted: true, expected: [false, false, true] },
  {
    viewer: { type: "anonymous" } satisfies Viewer,
    permitted: true,
    expected: [false, false, false],
  },
])(
  "limits shared header links for $viewer.type with member permission $permitted",
  async ({ viewer, permitted, expected: [staffLink, membersLink, logout] }) => {
    vi.clearAllMocks();
    vi.mocked(getViewer).mockResolvedValue(viewer);
    vi.mocked(canReadTenantMembers).mockResolvedValue(permitted);
    const markup = renderToStaticMarkup(
      await ManagementLayout({
        params: Promise.resolve({ tenantId }),
        children: <main>Workspace</main>,
      }),
    );

    expect(markup).toContain(
      `<header data-staff="${staffLink}" data-members="${membersLink}" data-logout="${logout}"></header><main>Workspace</main>`,
    );
    expect(canReadTenantMembers).toHaveBeenCalledTimes(staffLink ? 1 : 0);
  },
);
