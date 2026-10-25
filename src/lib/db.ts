import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import * as schema from "./schema";

export type DB = LibSQLDatabase<typeof schema>;

let client: Client | null = null;
let dbInstance: DB | null = null;
let initPromise: Promise<DB> | null = null;
let seeded = false;

function findDbUrl(): string | undefined {
  return process.env.TURSO_DATABASE_URL || undefined;
}

const DEFAULT_SETTINGS: [string, string][] = [
  ["upstream_api_key", ""],
  ["default_sender", "SMMSOFT"],
  ["price_per_credit", "0.65"],
  ["cost_regular", "1"],
  ["cost_priority", "2"],
  ["cost_otp", "2"],
  ["welcome_credits", "0"],
  [
    "payment_instructions",
    "Pay via GCash: 09XX XXX XXXX (SMMSOFT). After paying, submit the reference number below. Credits are added once the admin verifies your payment.",
  ],
  ["balance_cache", ""],
  ["balance_cached_at", "0"],
];

/** Seeds settings defaults, the SMMSOFT sender, and the admin account (first boot only). */
async function ensureSeed(db: DB): Promise<void> {
  if (seeded) return;
  seeded = true;
  for (const [k, v] of DEFAULT_SETTINGS) {
    await db
      .insert(schema.smsSettings)
      .values({ k, v })
      .onConflictDoNothing();
  }
  const senders = await db.select().from(schema.smsSenders).limit(1);
  if (senders.length === 0) {
    await db.insert(schema.smsSenders).values({ name: "SMMSOFT", isDefault: 1 }).onConflictDoNothing();
  }
  const admins = await db.select().from(schema.users).limit(1);
  if (admins.length === 0) {
    // Admin login: admin@smmsoft.local / admin123 — change the password immediately
    // after first sign-in (Settings). The API key is random (never a known default).
    await db.insert(schema.users).values({
      name: "SMMSOFT Admin",
      email: "admin@smmsoft.local",
      passwordHash: bcrypt.hashSync("admin123", 10),
      apiKey: randomBytes(20).toString("hex"),
      credits: 0,
      isAdmin: 1,
      status: "active",
    });
  }
}

/**
 * Returns the shared Drizzle client. The first call applies the SQL
 * migrations in ./drizzle and seeds the default records.
 * Connection: a Turso (libSQL) URL from the environment when present,
 * otherwise a local SQLite file for development. On serverless hosts the
 * project directory is read-only, so the local fallback lives in /tmp.
 */
export function getDb(): Promise<DB> {
  if (!initPromise) {
    initPromise = (async () => {
      const url =
        findDbUrl() ||
        (process.env.VERCEL ? "file:/tmp/local.db" : "file:./local.db");
      const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
      client = createClient({ url, authToken });
      dbInstance = drizzle(client, { schema });
      await migrate(dbInstance, { migrationsFolder: "./drizzle" });
      await ensureSeed(dbInstance);
      return dbInstance;
    })();
  }
  return initPromise;
}
