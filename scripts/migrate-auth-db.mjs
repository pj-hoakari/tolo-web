import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.AUTH_DATABASE_URL) {
  throw new Error("set AUTH_DATABASE_URL to the BFF's PostgreSQL");
}

const client = new pg.Client({
  connectionString: process.env.AUTH_DATABASE_URL,
});
await client.connect();
try {
  await client.query(
    await readFile(new URL("../db/auth.sql", import.meta.url), "utf8"),
  );
} finally {
  await client.end();
}
