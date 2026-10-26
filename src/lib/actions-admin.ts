'use server';

import { asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { smsSenders, topups, users } from '@/lib/schema';
import { settingSet } from '@/lib/settings';
import { walletApply } from '@/lib/sms';

export type AdminActionResult = { ok: boolean; message: string };

function denied(): AdminActionResult {
  return { ok: false, message: 'Admin access required.' };
}

function done() {
  revalidatePath('/admin');
}

/** Admin-only: adjust a user's credits by a signed delta. */
export async function adjustCredits(
  userId: number,
  delta: number,
  note: string,
): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return denied();
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, message: 'Enter a non-zero amount.' };
  }
  const result = await walletApply(userId, Math.trunc(delta), 'adjust', note.trim() || 'Admin adjustment');
  if (result === false) {
    return { ok: false, message: 'Adjustment failed (would make the balance negative).' };
  }
  done();
  return { ok: true, message: `Balance updated: ${result.toLocaleString('en-PH')} credits.` };
}

/** Admin-only: suspend or activate a non-admin user. */
export async function setUserStatus(
  userId: number,
  status: 'active' | 'suspended',
): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return denied();
  if (status !== 'active' && status !== 'suspended') {
    return { ok: false, message: 'Invalid status.' };
  }
  const db = await getDb();
  await db
    .update(users)
    .set({ status })
    .where(sql`${users.id} = ${userId} AND ${users.isAdmin} = 0`);
  done();
  return { ok: true, message: 'User status updated.' };
}

/** Admin-only: approve (credits the user) or reject a pending top-up. */
export async function decideTopup(
  topupId: number,
  decision: 'approve' | 'reject',
): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return denied();
  if (decision !== 'approve' && decision !== 'reject') {
    return { ok: false, message: 'Invalid decision.' };
  }
  const db = await getDb();
  const rows = await db
    .select()
    .from(topups)
    .where(sql`${topups.id} = ${topupId} AND ${topups.status} = 'pending'`)
    .limit(1);
  const topup = rows[0];
  if (!topup) {
    return { ok: false, message: 'Top-up not found or already decided.' };
  }
  if (decision === 'approve') {
    const credited = await walletApply(
      topup.userId,
      topup.creditsWanted,
      'purchase',
      `Top-up approved #${topupId}`,
    );
    if (credited === false) {
      return { ok: false, message: 'Top-up approval failed.' };
    }
    await db
      .update(topups)
      .set({ status: 'approved', decidedAt: new Date() })
      .where(eq(topups.id, topupId));
    done();
    return { ok: true, message: 'Top-up approved and credits added.' };
  }
  await db
    .update(topups)
    .set({ status: 'rejected', decidedAt: new Date() })
    .where(eq(topups.id, topupId));
  done();
  return { ok: true, message: 'Top-up rejected.' };
}

/** Admin-only: add a sender name to the pool (never auto-set as default). */
export async function addSender(name: string): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return denied();
  const trimmed = name.trim();
  if (!/^[A-Za-z0-9]{1,11}$/.test(trimmed)) {
    return { ok: false, message: 'Sender names are 1–11 characters — letters and numbers only.' };
  }
  const db = await getDb();
  const existing = await db.select().from(smsSenders);
  if (existing.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, message: 'That sender name is already in the pool.' };
  }
  await db
    .insert(smsSenders)
    .values({ name: trimmed, isDefault: 0 })
    .onConflictDoNothing();
  done();
  return { ok: true, message: `Sender name added to the pool: ${trimmed}` };
}

/** Admin-only: remove a sender; refuses when it is the last one, and promotes
 *  the lowest-id remaining sender when the default is deleted. */
export async function deleteSender(id: number): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return denied();
  const db = await getDb();
  const rows = await db.select().from(smsSenders);
  if (rows.length <= 1) {
    return { ok: false, message: 'The pool needs at least one sender name.' };
  }
  const target = rows.find((s) => s.id === id);
  if (!target) return { ok: false, message: 'Sender name not found.' };
  const wasDefault = target.isDefault === 1;
  await db.delete(smsSenders).where(eq(smsSenders.id, id));
  if (wasDefault) {
    const remaining = await db
      .select()
      .from(smsSenders)
      .orderBy(asc(smsSenders.id))
      .limit(1);
    if (remaining[0]) {
      await db
        .update(smsSenders)
        .set({ isDefault: 1 })
        .where(eq(smsSenders.id, remaining[0].id));
    }
  }
  done();
  return { ok: true, message: 'Sender name removed from the pool.' };
}

/** Admin-only: clear all defaults and set the chosen sender as default. */
export async function setDefaultSender(id: number): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return denied();
  const db = await getDb();
  const rows = await db.select().from(smsSenders).where(eq(smsSenders.id, id)).limit(1);
  if (!rows[0]) return { ok: false, message: 'Sender name not found.' };
  await db.update(smsSenders).set({ isDefault: 0 });
  await db.update(smsSenders).set({ isDefault: 1 }).where(eq(smsSenders.id, id));
  done();
  return { ok: true, message: 'Default sender name updated.' };
}

/**
 * Admin-only: save platform settings from the settings form.
 * An empty upstream_api_key keeps the existing stored key (never echoed);
 * an empty unisms_secret_key likewise keeps the existing UniSMS key.
 * upstream_provider is "semaphore" unless exactly "unisms".
 * Invalid numeric values are rejected with an error, nothing is saved.
 */
export async function savePlatformSettings(form: FormData): Promise<AdminActionResult> {
  if (!(await requireAdmin())) return denied();
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v.trim() : '';
  };

  const priceRaw = get('price_per_credit');
  const price = parseFloat(priceRaw);
  if (priceRaw === '' || !Number.isFinite(price) || price <= 0) {
    return { ok: false, message: 'Price per credit must be a number greater than 0.' };
  }
  const intField = (k: string): number | null => {
    const raw = get(k);
    if (raw === '' || !/^-?\d+$/.test(raw)) return null;
    return parseInt(raw, 10);
  };
  const costRegular = intField('cost_regular');
  const costPriority = intField('cost_priority');
  const costOtp = intField('cost_otp');
  const welcome = intField('welcome_credits');
  if (
    costRegular === null || costRegular < 0 ||
    costPriority === null || costPriority < 0 ||
    costOtp === null || costOtp < 0 ||
    welcome === null || welcome < 0
  ) {
    return { ok: false, message: 'Credit costs and welcome credits must be whole numbers of 0 or more.' };
  }

  const upstreamKey = get('upstream_api_key');
  if (upstreamKey !== '') await settingSet('upstream_api_key', upstreamKey);
  const unismsKey = get('unisms_secret_key');
  if (unismsKey !== '') await settingSet('unisms_secret_key', unismsKey);
  const providerRaw = get('upstream_provider');
  await settingSet('upstream_provider', providerRaw === 'unisms' ? 'unisms' : 'semaphore');
  // default_sender IS in admin.php's settings form, so it is saved here too.
  await settingSet('default_sender', get('default_sender'));
  await settingSet('price_per_credit', String(price));
  await settingSet('cost_regular', String(costRegular));
  await settingSet('cost_priority', String(costPriority));
  await settingSet('cost_otp', String(costOtp));
  await settingSet('welcome_credits', String(welcome));
  await settingSet('payment_instructions', get('payment_instructions'));
  await settingSet('balance_cached_at', '0');
  done();
  return { ok: true, message: 'Platform settings saved.' };
}
