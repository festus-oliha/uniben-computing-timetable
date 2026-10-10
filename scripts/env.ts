// Loads .env.local (then .env) for command-line scripts, the same files Next.js reads.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
