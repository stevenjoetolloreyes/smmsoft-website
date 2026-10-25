import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { creditTransactions, users } from "./schema";
import { settingInt } from "./settings";

/** Normalize a raw number to 09xxxxxxxxx, or null when invalid (PHP ph_normalize). */
export function phNormalize(raw: string): string | null {
  let n = String(raw).replace(/[^0-9+]/g, "");
  if (n.startsWith("+63")) n = "0" + n.slice(3);
  else if (n.startsWith("63") && n.length === 12) n = "0" + n.slice(2);
  return /^09\d{9}$/.test(n) ? n : null;
}

/** SMS parts: 1 part up to 160 chars, then 153 chars per part (PHP sms_segments). */
export function smsSegments(message: string): number {
  const len = [...message].length;
  if (len === 0) return 0;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

/** Credit cost of one send: segments x recipients x per-kind credit cost. */
export async function sendCost(message: string, recipientCount: number, kind: string): Promise<number> {
  const per = await settingInt(`cost_${kind}`, kind === "regular" ? 1 : 2);
  return smsSegments(message) * Math.max(0, recipientCount) * per;
}

export async function userCredits(userId: number): Promise<number> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ? rows[0].credits : 0;
}

/**
 * Apply a signed credit change + write the ledger row. Returns the new
 * balance, or false when it would go negative on a debit (PHP wallet_apply).
 */
export async function walletApply(
  userId: number,
  delta: number,
  type: "purchase" | "send" | "refund" | "adjust",
  note = "",
): Promise<number | false> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    const row = rows[0];
    if (!row) return false;
    const next = row.credits + delta;
    if (next < 0) return false;
    await tx.update(users).set({ credits: next }).where(eq(users.id, userId));
    await tx.insert(creditTransactions).values({ userId, type, amount: delta, balanceAfter: next, note });
    return next;
  });
}

export function formatPeso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatInt(n: number): string {
  return n.toLocaleString("en-PH");
}

export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}
