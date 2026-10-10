import "server-only";
import { getDb } from "./client";

/** The app-wide database handle (Supabase/Postgres when DATABASE_URL is set, else the local PGlite store). */
export const db = getDb();
