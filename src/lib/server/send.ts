import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { smsMessages, smsSenders } from "../schema";
import { settingGet, settingInt } from "../settings";
import { smsSegments, userCredits, walletApply } from "../sms";
import { upstreamSend, upstreamSender, type UpstreamResult } from "./upstream";

/** Pool names, default first, then A–Z (PHP senders_pool). */
export async function sendersPool(): Promise<string[]> {
  const db = await getDb();
  await sendersEnsure();
  const rows = await db.select().from(smsSenders).orderBy(desc(smsSenders.isDefault), asc(smsSenders.name));
  return rows.map((r) => r.name);
}

export async function sendersEnsure(): Promise<void> {
  const db = await getDb();
  const rows = await db.select().from(smsSenders).limit(1);
  if (rows.length === 0) {
    const seed = (await upstreamSender()) || "SMMSOFT";
    await db
      .insert(smsSenders)
      .values({ name: seed.slice(0, 11), isDefault: 1 })
      .onConflictDoNothing();
  }
}

export async function senderDefault(): Promise<string> {
  await sendersEnsure();
  const db = await getDb();
  const rows = await db
    .select()
    .from(smsSenders)
    .where(eq(smsSenders.isDefault, 1))
    .orderBy(asc(smsSenders.id))
    .limit(1);
  if (rows[0]) return rows[0].name;
  const pool = await sendersPool();
  return pool[0] ?? (await upstreamSender());
}

/** The pool's canonical spelling of a requested name, or null if not pooled. */
export async function senderPoolName(name: string): Promise<string | null> {
  const wanted = name.trim();
  if (wanted === "") return null;
  const pool = await sendersPool();
  const hit = pool.find((s) => s.toLowerCase() === wanted.toLowerCase());
  return hit ?? null;
}

export type SendResult =
  | { ok: true; sent: number; cost: number; message_ids: number[]; sender: string }
  | { ok: false; error: string; httpStatus: 402 | 422 | 502; partialSent?: number };

function storeResults(
  results: UpstreamResult,
  userId: number,
  fallbackMessage: string,
  kind: string,
  creditsPerRecipient: number,
  source: string,
): Promise<number> {
  return (async () => {
    if (!Array.isArray(results)) return 0;
    const db = await getDb();
    const now = new Date();
    let n = 0;
    for (const m of results) {
      if (!m) continue;
      // Semaphore/mock rows carry a numeric message_id; UniSMS rows carry a
      // string provider_ref instead. Either one stores a row; a row with
      // neither is skipped (never charged).
      const hasNumericId = typeof m.message_id === "number";
      const hasRef = typeof m.provider_ref === "string" && m.provider_ref !== "";
      if (!hasNumericId && !hasRef) continue;
      await db.insert(smsMessages).values({
        userId,
        semaphoreId: hasNumericId ? m.message_id : null,
        providerRef: hasRef ? (m.provider_ref as string) : null,
        recipient: String(m.recipient ?? ""),
        message: String(m.message ?? fallbackMessage),
        senderName: String(m.sender_name ?? ""),
        network: String(m.network ?? ""),
        status: String(m.status ?? "Queued"),
        msgType: String(m.type ?? "Single"),
        kind,
        creditsCharged: creditsPerRecipient,
        source,
        createdAt: m.created_at ? new Date(m.created_at.replace(" ", "T")) : now,
        updatedAt: m.updated_at ? new Date(m.updated_at.replace(" ", "T")) : now,
        loggedAt: now,
      });
      n++;
    }
    return n;
  })();
}

/**
 * The core send operation used by BOTH the web UI and the customer API.
 * Checks balance, sends via upstream, deducts credits, stores messages.
 * Mirrors PHP smmsoft_send, including: pool resolution (unknown sender →
 * 422, no deduction), TEST block, per-recipient segment cost, 1000-number
 * chunks, charge only for stored rows, unsent chunks not charged.
 */
export async function smmsoftSend(
  userId: number,
  numbers: string[],
  message: string,
  kind: "regular" | "priority" | "otp" = "regular",
  code: string | null = null,
  source: "web" | "api" = "web",
  sender: string | null = null,
): Promise<SendResult> {
  const unique = [...new Set(numbers.filter(Boolean))];
  if (unique.length === 0) return { ok: false, error: "No valid recipients.", httpStatus: 422 };
  if (message.trim().toUpperCase().startsWith("TEST")) {
    return { ok: false, error: "Messages starting with TEST are ignored by the network.", httpStatus: 422 };
  }
  let useSender: string;
  if (sender === null || sender.trim() === "") {
    useSender = await senderDefault();
  } else {
    const pooled = await senderPoolName(sender);
    if (pooled === null) {
      return {
        ok: false,
        error: `Sender name "${sender.trim()}" is not in the approved sender pool.`,
        httpStatus: 422,
      };
    }
    useSender = pooled;
  }
  const segments = smsSegments(message);
  const per = await settingInt(`cost_${kind}`, kind === "regular" ? 1 : 2);
  const perRecipient = segments * per;
  const total = perRecipient * unique.length;
  const balance = await userCredits(userId);
  if (balance < total) {
    return {
      ok: false,
      error: `Insufficient credits. This send needs ${total} credit(s); your balance is ${balance}.`,
      httpStatus: 402,
    };
  }
  const sentIds: number[] = [];
  let sentCount = 0;
  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    const res = await upstreamSend(chunk, message, kind, code, useSender);
    if (!Array.isArray(res)) {
      return { ok: false, error: `Upstream error: ${res.error}`, httpStatus: 502, partialSent: sentCount };
    }
    const stored = await storeResults(res, userId, message, kind, perRecipient, source);
    sentCount += stored;
    const charge = perRecipient * stored;
    if (charge > 0) {
      await walletApply(userId, -charge, "send", `${kind[0].toUpperCase()}${kind.slice(1)} SMS x${stored}`);
    }
    for (const m of res) if (typeof m.message_id === "number") sentIds.push(m.message_id);
  }
  return { ok: true, sent: sentCount, cost: total, message_ids: sentIds, sender: useSender };
}

/** Refresh helper for the Messages page (PHP ?refresh=1 behavior). */
export async function refreshMessageStatuses(userId: number): Promise<number> {
  const { upstreamMessage } = await import("./upstream");
  const db = await getDb();
  const rows = await db
    .select()
    .from(smsMessages)
    .where(eq(smsMessages.userId, userId));
  const pending = rows
    .filter((r) => r.semaphoreId !== null && (r.status === "Queued" || r.status === "Pending"))
    .sort((a, b) => b.id - a.id)
    .slice(0, 25);
  let updated = 0;
  for (const r of pending) {
    if (r.semaphoreId === null) continue;
    const m = await upstreamMessage(r.semaphoreId);
    if (!("error" in m) && m.status) {
      await db
        .update(smsMessages)
        .set({
          status: String(m.status),
          network: String(m.network ?? ""),
          updatedAt: m.updated_at ? new Date(m.updated_at.replace(" ", "T")) : new Date(),
        })
        .where(eq(smsMessages.id, r.id));
      updated++;
    }
  }
  return updated;
}

export async function defaultSenderSetting(): Promise<string> {
  return settingGet("default_sender", "SMMSOFT");
}
