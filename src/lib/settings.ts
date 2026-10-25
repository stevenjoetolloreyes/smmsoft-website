import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { smsSettings } from "./schema";

export async function settingGet(key: string, fallback = ""): Promise<string> {
  try {
    const db = await getDb();
    const rows = await db.select().from(smsSettings).where(eq(smsSettings.k, key)).limit(1);
    const v = rows[0]?.v;
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

export async function settingSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(smsSettings)
    .values({ k: key, v: value })
    .onConflictDoUpdate({ target: smsSettings.k, set: { v: value } });
}

export async function settingInt(key: string, fallback: number): Promise<number> {
  const raw = await settingGet(key, "");
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function settingFloat(key: string, fallback: number): Promise<number> {
  const raw = await settingGet(key, "");
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}
