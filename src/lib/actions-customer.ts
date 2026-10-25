'use server';

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import {
  attemptLogin,
  findUserById,
  getSession,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "./auth";
import { getDb } from "./db";
import { creditTransactions, smsContacts, topups, users } from "./schema";
import { settingFloat } from "./settings";
import { formatInt, phNormalize } from "./sms";
import { refreshMessageStatuses, smmsoftSend } from "./server/send";

import type { ActionState } from "./action-state";

const err = (message: string): ActionState => ({ ok: false, message });
const ok = (message: string): ActionState => ({ ok: true, message });

type Kind = "regular" | "priority" | "otp";

function parseKind(raw: string | null): Kind {
  return raw === "priority" || raw === "otp" ? raw : "regular";
}

async function requireUserId(): Promise<number | null> {
  const session = await getSession();
  return session ? session.id : null;
}

/* ------------------------------ auth ------------------------------ */

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (name === "" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err("Please enter your name and a valid email.");
  }
  if (password.length < 6) return err("Password must be at least 6 characters.");
  if (password !== confirm) return err("Passwords do not match.");
  const db = await getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return err("That email is already registered. Please log in.");
  const { settingInt } = await import("./settings");
  const welcome = Math.max(0, await settingInt("welcome_credits", 0));
  const inserted = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: hashPassword(password),
      apiKey: randomBytes(20).toString("hex"),
      credits: welcome,
      isAdmin: 0,
      status: "active",
    })
    .returning({ id: users.id });
  const uid = inserted[0]?.id;
  if (!uid) return err("Could not create your account. Please try again.");
  if (welcome > 0) {
    await db.insert(creditTransactions).values({
      userId: uid,
      type: "adjust",
      amount: welcome,
      balanceAfter: welcome,
      note: "Welcome credits",
    });
  }
  await setSessionCookie({ id: uid, name, email, isAdmin: false });
  redirect("/dashboard");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = await attemptLogin(email, password);
  if (!user) return err("Invalid email or password.");
  await setSessionCookie(user);
  redirect("/dashboard");
}

/* ------------------------------ send ------------------------------ */

function splitRecipients(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\n,]+/)) {
    const piece = part.trim();
    if (piece === "") continue;
    const n = phNormalize(piece);
    if (n) {
      if (!seen.has(n)) {
        seen.add(n);
        valid.push(n);
      }
    } else {
      invalid.push(piece);
    }
  }
  return { valid, invalid };
}

export async function sendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const { valid, invalid } = splitRecipients(String(formData.get("recipients") ?? ""));
  const message = String(formData.get("message") ?? "").trim();
  const kind = parseKind(String(formData.get("kind") ?? "regular"));
  const codeRaw = String(formData.get("otp_code") ?? "").trim();
  const senderRaw = String(formData.get("sender") ?? "").trim();
  if (valid.length === 0) return err("No valid PH mobile numbers. Use 09xxxxxxxxx format.");
  if (message === "") return err("Message is empty.");
  const res = await smmsoftSend(uid, valid, message, kind, kind === "otp" ? codeRaw || null : null, "web", senderRaw || null);
  if (!res.ok) {
    const partial = res.partialSent ? ` (${res.partialSent} message(s) were sent before the failure.)` : "";
    return err(res.error + partial);
  }
  const { userCredits } = await import("./sms");
  const balance = await userCredits(uid);
  let msg = `Sent to ${res.sent} recipient(s). Cost: ${res.cost} credits. New balance: ${formatInt(balance)}.`;
  if (invalid.length > 0) msg += ` Skipped ${invalid.length} invalid number(s): ${invalid.join(", ")}`;
  revalidatePath("/send");
  revalidatePath("/dashboard");
  return ok(msg);
}

/* ------------------------------ bulk ------------------------------ */

/** Minimal CSV parser: quoted fields, "" escapes, CRLF/LF rows. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export async function bulkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) return err("Please choose a CSV file.");
  const text = await file.text();
  const senderRaw = String(formData.get("sender") ?? "").trim();
  const defaultMessage = String(formData.get("default_message") ?? "").trim();
  const rawRows = parseCsv(text);
  if (rawRows.length === 0) return err("No valid rows found. Format: name,number,message (one per line).");

  // Header detection: first row names its columns (name/number/message).
  let numberIdx = 0;
  let nameIdx = -1;
  let messageIdx = 1;
  let start = 0;
  const header = rawRows[0].map((c) => c.trim().toLowerCase());
  if (header.includes("number")) {
    numberIdx = header.indexOf("number");
    nameIdx = header.indexOf("name");
    messageIdx = header.indexOf("message");
    start = 1;
  }

  const rows: [string, string][] = [];
  let skipped = 0;
  for (let i = start; i < rawRows.length; i++) {
    const cells = rawRows[i];
    const n = phNormalize(cells[numberIdx] ?? "");
    const name = nameIdx >= 0 ? (cells[nameIdx] ?? "").trim() : "";
    let msg =
      messageIdx >= 0
        ? cells
            .slice(messageIdx)
            .join(",")
            .trim()
        : "";
    if (msg === "" && defaultMessage !== "") msg = defaultMessage;
    if (name !== "") msg = msg.split("{name}").join(name);
    if (!n || msg === "" || msg.toUpperCase().startsWith("TEST")) {
      skipped++;
      continue;
    }
    rows.push([n, msg]);
  }
  if (rows.length === 0) {
    return err("No valid rows found. Format: name,number,message (one per line).");
  }
  let sent = 0;
  for (const [n, msg] of rows) {
    const res = await smmsoftSend(uid, [n], msg, "regular", null, "web", senderRaw || null);
    if (!res.ok) return err(`Stopped after ${sent} message(s): ${res.error}`);
    sent += res.sent;
  }
  const { userCredits } = await import("./sms");
  const balance = await userCredits(uid);
  let msg = `Bulk send finished: ${sent} message(s) queued. New balance: ${formatInt(balance)} credits.`;
  if (skipped > 0) msg += ` Skipped ${skipped} invalid row(s).`;
  revalidatePath("/bulk");
  revalidatePath("/dashboard");
  return ok(msg);
}

/* ------------------------------ messages ------------------------------ */

export async function refreshMessagesAction(): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const updated = await refreshMessageStatuses(uid);
  revalidatePath("/messages");
  return ok(`Refreshed ${updated} message status(es).`);
}

/* ------------------------------ contacts ------------------------------ */

export async function addContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const name = String(formData.get("name") ?? "").trim();
  const number = phNormalize(String(formData.get("number") ?? ""));
  const group = String(formData.get("group_name") ?? "").trim() || "General";
  if (name === "") return err("Name is required.");
  if (!number) return err("Invalid number. Use 09xxxxxxxxx.");
  const db = await getDb();
  await db.insert(smsContacts).values({ userId: uid, name, number, groupName: group });
  revalidatePath("/contacts");
  return ok("Contact added.");
}

export async function editContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const id = parseInt(String(formData.get("id") ?? ""), 10);
  const name = String(formData.get("name") ?? "").trim();
  const number = phNormalize(String(formData.get("number") ?? ""));
  const group = String(formData.get("group_name") ?? "").trim() || "General";
  if (!Number.isFinite(id)) return err("Invalid contact.");
  if (name === "") return err("Name is required.");
  if (!number) return err("Invalid number. Use 09xxxxxxxxx.");
  const db = await getDb();
  await db
    .update(smsContacts)
    .set({ name, number, groupName: group })
    .where(and(eq(smsContacts.id, id), eq(smsContacts.userId, uid)));
  revalidatePath("/contacts");
  return ok("Contact updated.");
}

export async function deleteContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const id = parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id)) return err("Invalid contact.");
  const db = await getDb();
  await db.delete(smsContacts).where(and(eq(smsContacts.id, id), eq(smsContacts.userId, uid)));
  revalidatePath("/contacts");
  return ok("Contact deleted.");
}

export async function groupSendAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const group = String(formData.get("group") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const kind = parseKind(String(formData.get("kind") ?? "regular"));
  const codeRaw = String(formData.get("otp_code") ?? "").trim();
  const senderRaw = String(formData.get("sender") ?? "").trim();
  if (group === "") return err("Please choose a group.");
  if (message === "") return err("Message is empty.");
  const db = await getDb();
  const members = await db
    .select()
    .from(smsContacts)
    .where(and(eq(smsContacts.userId, uid), eq(smsContacts.groupName, group)))
    .orderBy(asc(smsContacts.name));
  const numbers = members.map((m) => m.number);
  if (numbers.length === 0) return err("No contacts in that group.");
  const res = await smmsoftSend(uid, numbers, message, kind, kind === "otp" ? codeRaw || null : null, "web", senderRaw || null);
  if (!res.ok) return err(res.error);
  const { userCredits } = await import("./sms");
  const balance = await userCredits(uid);
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  return ok(`Sent to ${res.sent} recipient(s) in "${group}". Cost: ${res.cost} credits. New balance: ${formatInt(balance)}.`);
}

/* ------------------------------ credits ------------------------------ */

export async function topupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const credits = parseInt(String(formData.get("credits") ?? "").replace(/[^\d]/g, ""), 10);
  const payRef = String(formData.get("pay_ref") ?? "").trim();
  if (!Number.isFinite(credits) || credits <= 0) {
    return err("Credits wanted must be a positive number.");
  }
  const price = await settingFloat("price_per_credit", 0.65);
  const db = await getDb();
  await db.insert(topups).values({
    userId: uid,
    creditsWanted: credits,
    amountPeso: credits * price,
    payRef: payRef === "" ? null : payRef,
    status: "pending",
  });
  revalidatePath("/credits");
  return ok("Top-up request submitted. Credits will appear once the admin verifies your payment.");
}

/* ------------------------------ settings ------------------------------ */

export async function updateNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return err("Please log in again.");
  const name = String(formData.get("name") ?? "").trim();
  if (name === "") return err("Name is required.");
  const db = await getDb();
  await db.update(users).set({ name }).where(eq(users.id, session.id));
  await setSessionCookie({ ...session, name });
  revalidatePath("/settings");
  return ok("Name saved.");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("new") ?? "");
  const next2 = String(formData.get("new2") ?? "");
  const row = await findUserById(uid);
  if (!row || !verifyPassword(current, row.passwordHash)) {
    return err("Current password is wrong.");
  }
  if (next.length < 6) return err("New password must be at least 6 characters.");
  if (next !== next2) return err("New passwords do not match.");
  const db = await getDb();
  await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, uid));
  revalidatePath("/settings");
  return ok("Password changed.");
}

/* ------------------------------ API key ------------------------------ */

export async function regenerateApiKeyAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const uid = await requireUserId();
  if (uid === null) return err("Please log in again.");
  const key = randomBytes(20).toString("hex");
  const db = await getDb();
  await db.update(users).set({ apiKey: key }).where(eq(users.id, uid));
  revalidatePath("/api-access");
  return ok(`New API key generated: ${key}. The old key stops working immediately.`);
}
