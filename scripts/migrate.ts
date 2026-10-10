/**
 * Applies the SQL migrations in ./drizzle to the database.
 * Uses Supabase/Postgres when DATABASE_URL is set, otherwise the built-in local database in ./.data.
 *
 *   npm run db:migrate
 */
import "./env";
import { closeDb, getDb, LOCAL_DB_DIR } from "../src/lib/db/client";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  const db = getDb();
  if (url) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
    console.log("✔ Migrations applied to the Postgres database in DATABASE_URL.");
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
    console.log(`✔ Migrations applied to the local database in ${process.env.PGLITE_DIR || LOCAL_DB_DIR}.`);
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error("✖ Migration failed:", err);
  await closeDb();
  process.exit(1);
});
