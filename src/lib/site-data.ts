import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { siteContent } from "./db/schema";
import { normaliseHome, type HomeContent } from "./home-content";

/** The Dean's profile, mission and vision (empty until the Faculty Officer fills them in under Settings). */
export async function getHomeContent(): Promise<HomeContent> {
  try {
    const [row] = await db.select().from(siteContent).where(eq(siteContent.key, "home"));
    return normaliseHome(row?.value);
  } catch {
    return normaliseHome(null); // the public page still renders if the table isn't there yet
  }
}
