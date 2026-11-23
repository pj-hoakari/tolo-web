import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authOptions } from "./betterAuth";
import { applyMigrations } from "./migrations";

describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)("on PostgreSQL", () => {
  const schema = `migrations_test_${process.pid}_${Date.now()}`;
  const pool = new Pool({
    connectionString: process.env.AUTH_TEST_DATABASE_URL,
    options: `-c search_path=${schema}`,
  });

  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await applyMigrations(pool);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  });

  it("leaves nothing for Better Auth to migrate", async () => {
    const options = authOptions({
      databaseUrl: "postgres://unused",
      secret: "a-test-secret-that-is-long-enough-for-better-auth",
      issuer: "https://idp.test",
      clientId: "console-ui",
      clientSecret: "console-secret",
      resourceHost: "api.tolo.test",
      connectionClientId: "observation-connection",
      connectionClientSecret: "connection-secret",
      machineClientId: "edge-page",
      machineClientSecret: "machine-secret",
    });

    const plan = await getMigrations({ ...options, database: pool });

    expect(plan).toMatchObject({
      toBeCreated: [],
      toBeAdded: [],
      toBeAddedIndexes: [],
      schemaProblems: [],
    });
  });
});
