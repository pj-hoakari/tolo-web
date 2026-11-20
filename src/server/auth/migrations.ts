import { readdir, readFile } from "node:fs/promises";
import type { Pool } from "pg";

const MIGRATIONS = new URL("../../../db/migrations/", import.meta.url);

export async function applyMigrations(pool: Pool) {
  const files = (await readdir(MIGRATIONS))
    .filter((name) => name.endsWith(".up.sql"))
    .sort();
  for (const file of files) {
    await pool.query(await readFile(new URL(file, MIGRATIONS), "utf8"));
  }
}
