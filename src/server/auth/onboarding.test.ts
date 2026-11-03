import { readFile } from "node:fs/promises";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { RealAuth } from "./betterAuth";
import { createOnboarding, tenantOnboarding } from "./onboarding";

const input = { name: "Acme", subdomain: "acme", displayName: "Owner" };

function setUp(
  database: BetterAuthOptions["database"] = memoryAdapter({
    user: [],
    session: [],
    account: [],
    verification: [],
    tenantRegistration: [],
  }),
) {
  const auth = betterAuth({
    secret: "a-test-secret-that-is-long-enough-for-better-auth",
    baseURL: "https://tolo.test",
    database,
    plugins: [tenantOnboarding],
  });
  let started = 0;
  const start = vi.fn(async () => {
    started += 1;
    return {
      tenantId: `tenant-${started}`,
      ownershipClaimToken: `claim-${started}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  });
  return {
    onboarding: createOnboarding({ auth: auth as unknown as RealAuth["auth"] }),
    start,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("tenant onboarding state", () => {
  it("starts one provisional tenant and keeps it with the owner's input, bound to the browser", async () => {
    const { onboarding, start } = setUp();

    const { binding } = await onboarding.keep(undefined, input, start);

    expect(start).toHaveBeenCalledOnce();
    await expect(onboarding.bound(binding)).resolves.toMatchObject({
      ...input,
      tenantId: "tenant-1",
      ownershipClaimToken: "claim-1",
    });
    await expect(onboarding.bound("another-browser")).resolves.toBe(undefined);
  });

  it("reuses the kept provisional tenant when the owner submits again, taking only the new subdomain and display name", async () => {
    const { onboarding, start } = setUp();
    const first = await onboarding.keep(undefined, input, start);

    const second = await onboarding.keep(
      first.binding,
      { name: "Changed", subdomain: "acme-2", displayName: "Owner 2" },
      start,
    );

    expect(start).toHaveBeenCalledOnce();
    expect(second.binding).toBe(first.binding);
    await expect(onboarding.bound(first.binding)).resolves.toMatchObject({
      name: "Acme",
      subdomain: "acme-2",
      displayName: "Owner 2",
      tenantId: "tenant-1",
    });
  });

  it("starts a new provisional tenant once the kept one has expired", async () => {
    const { onboarding, start } = setUp();
    const first = await onboarding.keep(undefined, input, start);
    vi.useFakeTimers({ now: Date.now() + 2 * 60 * 60 * 1000 });

    const second = await onboarding.keep(first.binding, input, start);

    expect(start).toHaveBeenCalledTimes(2);
    await expect(onboarding.bound(first.binding)).resolves.toBe(undefined);
    await expect(onboarding.bound(second.binding)).resolves.toMatchObject({
      tenantId: "tenant-2",
    });
  });

  it("forgets the kept provisional tenant once it is claimed", async () => {
    const { onboarding, start } = setUp();
    const { binding } = await onboarding.keep(undefined, input, start);
    const kept = await onboarding.bound(binding);

    await onboarding.forget(kept?.id ?? "");

    await expect(onboarding.bound(binding)).resolves.toBe(undefined);
  });
});

describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)("on PostgreSQL", () => {
  const schema = `onboarding_test_${process.pid}_${Date.now()}`;
  const pool = new Pool({
    connectionString: process.env.AUTH_TEST_DATABASE_URL,
    options: `-c search_path=${schema}`,
  });

  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(
      await readFile(new URL("../../../db/auth.sql", import.meta.url), "utf8"),
    );
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  });

  it("keeps and reuses a provisional tenant", async () => {
    const { onboarding, start } = setUp(pool);
    const { binding } = await onboarding.keep(undefined, input, start);

    await onboarding.keep(binding, { ...input, subdomain: "acme-2" }, start);

    expect(start).toHaveBeenCalledOnce();
    await expect(onboarding.bound(binding)).resolves.toMatchObject({
      tenantId: "tenant-1",
      subdomain: "acme-2",
    });
  });
});
