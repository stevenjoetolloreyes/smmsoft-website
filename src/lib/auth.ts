import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "./schema";

export const SESSION_COOKIE = "smm_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
};

function secret(): string {
  return process.env.SESSION_SECRET || "smm-dev-secret-change-me-in-production";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionValue(user: SessionUser): string {
  const body = { ...user, exp: Date.now() + SESSION_TTL_MS };
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseSessionValue(value: string | undefined): SessionUser | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionUser> & {
      exp: number;
    };
    if (!body.exp || body.exp < Date.now()) return null;
    if (typeof body.id !== "number" || typeof body.email !== "string") return null;
    return { id: body.id, name: body.name ?? "", email: body.email, isAdmin: body.isAdmin === true };
  } catch {
    return null;
  }
}

/** Reads and verifies the current session from the request cookies. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return parseSessionValue(store.get(SESSION_COOKIE)?.value);
}

/** Returns the session user or null — pages redirect to /login when null. */
export async function requireSession(): Promise<SessionUser | null> {
  return getSession();
}

/** Returns the session user when it belongs to an admin, else null. */
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSession();
  return user && user.isAdmin ? user : null;
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionValue(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export type UserRow = typeof users.$inferSelect;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.email, email.trim())).limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Mirrors PHP attempt_login: active accounts only, bcrypt check. */
export async function attemptLogin(email: string, password: string): Promise<SessionUser | null> {
  const user = await findUserByEmail(email);
  if (!user || user.status !== "active" || !verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin === 1 };
}
