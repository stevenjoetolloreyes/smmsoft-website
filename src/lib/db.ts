import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
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
  ["upstream_provider", "semaphore"],
  ["unisms_secret_key", ""],
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
 * Embedded copy of drizzle/0000_romantic_mantis.sql (identifiers re-quoted
 * with double quotes so it can live in a template literal). Used ONLY when
 * the ./drizzle folder is not available at runtime: Vercel serverless
 * functions do not bundle it, so migrate() throws "Can't find
 * meta/_journal.json" there and every DB-touching page 500s. A fresh
 * database can still be created from this copy. If a future migration is
 * added, its SQL must be appended here too.
 */
const EMBEDDED_SCHEMA = `CREATE TABLE "credit_transactions" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"note" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "credit_transactions_user_idx" ON "credit_transactions" ("user_id");--> statement-breakpoint
CREATE TABLE "sms_contacts" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"group_name" text DEFAULT 'General' NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sms_contacts_user_idx" ON "sms_contacts" ("user_id");--> statement-breakpoint
CREATE INDEX "sms_contacts_group_idx" ON "sms_contacts" ("group_name");--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"semaphore_id" integer,
	"provider_ref" text,
	"recipient" text NOT NULL,
	"message" text NOT NULL,
	"sender_name" text,
	"network" text,
	"status" text DEFAULT 'Queued' NOT NULL,
	"msg_type" text DEFAULT 'Single' NOT NULL,
	"kind" text DEFAULT 'regular' NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"created_at" integer,
	"updated_at" integer,
	"logged_at" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sms_messages_user_idx" ON "sms_messages" ("user_id");--> statement-breakpoint
CREATE INDEX "sms_messages_status_idx" ON "sms_messages" ("status");--> statement-breakpoint
CREATE INDEX "sms_messages_semaphore_idx" ON "sms_messages" ("semaphore_id");--> statement-breakpoint
CREATE TABLE "sms_senders" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"name" text NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sms_senders_name_unique" ON "sms_senders" ("name");--> statement-breakpoint
CREATE TABLE "sms_settings" (
	"k" text PRIMARY KEY NOT NULL,
	"v" text
);
--> statement-breakpoint
CREATE TABLE "topups" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"credits_wanted" integer NOT NULL,
	"amount_peso" real NOT NULL,
	"pay_ref" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" integer NOT NULL,
	"decided_at" integer
);
--> statement-breakpoint
CREATE INDEX "topups_user_idx" ON "topups" ("user_id");--> statement-breakpoint
CREATE INDEX "topups_status_idx" ON "topups" ("status");--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"api_key" text NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"is_admin" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_api_key_unique" ON "users" ("api_key");`;

/**
 * Applies the schema, tolerating a missing ./drizzle folder (Vercel
 * serverless). migrate() fails before applying anything when the journal
 * is unreadable, so the fresh-database fallback below is safe. But an
 * EXISTING database is not upgraded by the fallback — so columns added by
 * later migrations must be listed in FALLBACK_COLUMN_ENSURES, or the first
 * insert naming them fails with "no such column". ADD AN ENTRY THERE
 * whenever a new migration adds a column (same rule as EMBEDDED_SCHEMA).
 */
async function migrateSafe(db: DB): Promise<void> {
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    return;
  } catch {
    // Fall through to the embedded schema below.
  }
  const existing = await db.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`,
  );
  if (existing.length === 0) {
    for (const chunk of EMBEDDED_SCHEMA.split("--> statement-breakpoint")) {
      const stmt = chunk.trim();
      if (stmt) await db.run(sql.raw(stmt));
    }
    return;
  }
  // Existing database: add any post-initial columns it predates.
  // (Table/column names are code constants, never user input.)
  for (const ensure of FALLBACK_COLUMN_ENSURES) {
    const cols = (await db.all(
      sql.raw(`PRAGMA table_info("${ensure.table}")`),
    )) as { name?: unknown }[];
    if (!cols.some((c) => c.name === ensure.column)) {
      await db.run(sql.raw(ensure.ddl));
    }
  }
}

/**
 * Columns added by migrations after the initial schema, for existing
 * databases the embedded fallback cannot migrate (see migrateSafe).
 */
const FALLBACK_COLUMN_ENSURES: { table: string; column: string; ddl: string }[] = [
  {
    table: "sms_messages",
    column: "provider_ref",
    ddl: `ALTER TABLE "sms_messages" ADD COLUMN "provider_ref" text`,
  },
];

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
      await migrateSafe(dbInstance);
      await ensureSeed(dbInstance);
      return dbInstance;
    })();
  }
  return initPromise;
}
