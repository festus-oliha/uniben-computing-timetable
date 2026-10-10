/**
 * Locked out? Sets a new temporary password for an account, from the terminal.
 *
 *   npm run user:reset-password -- you@example.com
 *
 * Prints the temporary password; the person must choose their own at next sign-in.
 */
import "./env";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/lib/db/client";
import { sessions, users } from "../src/lib/db/schema";
import { hashPassword, temporaryPassword } from "../src/lib/auth/password";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const db = getDb();
  if (!email) {
    const all = await db.select({ email: users.email, role: users.role }).from(users);
    console.log("Usage: npm run user:reset-password -- <email>\n\nAccounts:");
    for (const u of all) console.log(`  ${u.email}  (${u.role})`);
    if (!all.length) console.log("  (none yet — open the app to create the first account)");
    await closeDb();
    return;
  }
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u) {
    console.error(`✖ No account with email ${email}.`);
    await closeDb();
    process.exit(1);
  }
  const temp = temporaryPassword();
  await db.update(users).set({ passwordHash: await hashPassword(temp), mustChangePassword: true, isActive: true }).where(eq(users.id, u.id));
  await db.delete(sessions).where(eq(sessions.userId, u.id));
  console.log(`✔ New temporary password for ${u.name} (${u.email}):\n\n    ${temp}\n\nSign in with it; you'll be asked to choose your own.`);
  await closeDb();
}

main().catch(async (err) => {
  console.error("✖ Failed:", err);
  await closeDb();
  process.exit(1);
});
