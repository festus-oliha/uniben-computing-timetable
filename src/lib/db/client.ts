import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Where the built-in local database keeps its files when DATABASE_URL is empty. */
export const LOCAL_DB_DIR = ".data/pglite";

type Cache = { db?: Db; close?: () => Promise<void> };
const g = globalThis as unknown as { __timetableDb?: Cache };

/**
 * Returns one shared database connection.
 * - DATABASE_URL set   → real Postgres (Supabase) through postgres.js.
 * - DATABASE_URL empty → PGlite, a full Postgres engine stored in ./.data (no setup needed).
 * The connection is cached on globalThis so Next.js hot-reload doesn't open a new one per edit.
 */
export function getDb(): Db {
  const cache = (g.__timetableDb ??= {});
  if (cache.db) return cache.db;

  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres") as typeof import("postgres");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/postgres-js") as typeof import("drizzle-orm/postgres-js");
    // prepare:false keeps Supabase's transaction pooler (port 6543) happy.
    const sql = postgres(url, { prepare: false, max: 5 });
    cache.db = drizzle(sql, { schema }) as unknown as Db;
    cache.close = () => sql.end();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    const dir = process.env.PGLITE_DIR || LOCAL_DB_DIR;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("node:fs") as typeof import("node:fs")).mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    cache.db = drizzle(client, { schema }) as unknown as Db;
    cache.close = () => client.close();
  }
  return cache.db;
}

export async function closeDb() {
  const cache = g.__timetableDb;
  if (cache?.close) await cache.close();
  g.__timetableDb = undefined;
}
