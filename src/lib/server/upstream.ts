import "server-only";
import { settingGet, settingSet } from "../settings";
import { mockAccount, mockEnabled, mockMessage, mockSend, type MockMessageRow } from "./mock";

const SEMAPHORE_BASE = "https://api.semaphore.co/api/v4";

export type UpstreamMessage = {
  /** Semaphore/mock numeric id. UniSMS rows omit this and carry provider_ref instead. */
  message_id?: number;
  /** UniSMS reference_id (string, e.g. "msg_..."). Semaphore rows omit this. */
  provider_ref?: string;
  recipient?: string;
  message?: string;
  sender_name?: string;
  network?: string;
  status?: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
};

export type UpstreamResult = UpstreamMessage[] | { error: string; raw?: unknown };

function isError(r: UpstreamResult): r is { error: string; raw?: unknown } {
  return !Array.isArray(r) && typeof (r as { error?: unknown }).error === "string";
}

/** Upstream key: env wins, else the admin setting (PHP upstream_key). */
export async function upstreamKey(): Promise<string> {
  const env = (process.env.SEMAPHORE_API_KEY ?? "").trim();
  if (env !== "") return env;
  return (await settingGet("upstream_api_key", "")).trim();
}

/** Upstream provider: admin setting, default "semaphore" (existing behavior). */
export async function upstreamProvider(): Promise<"semaphore" | "unisms"> {
  const p = (await settingGet("upstream_provider", "semaphore")).trim().toLowerCase();
  return p === "unisms" ? "unisms" : "semaphore";
}

/** UniSMS secret key: env wins, else the admin setting. */
export async function unismsKey(): Promise<string> {
  const env = (process.env.UNISMS_SECRET_KEY ?? "").trim();
  if (env !== "") return env;
  return (await settingGet("unisms_secret_key", "")).trim();
}

/** UniSMS API base: env override (for local mock verification), else official PH API. */
function unismsBase(): string {
  const b = (process.env.UNISMS_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return b !== "" ? b : "https://unismsapi.com";
}

/**
 * UniSMS send (official PH UniSMS API: POST /api/sms, Basic auth with the
 * secret key as username and an empty password, JSON {recipient, content,
 * sender_id}). One recipient per call, so multiple numbers are sent
 * sequentially and aggregated. Chunk-atomic like Semaphore: any failure
 * returns {error} for the whole chunk (no partial rows stored/charged).
 * Kind does NOT change the endpoint — it only affects platform credit
 * costs, which live in send.ts and are untouched here. OTP content is
 * sent as-is; there is no separate code param for UniSMS.
 */
async function unismsSend(
  numbers: string[],
  message: string,
  senderName: string,
): Promise<UpstreamResult> {
  const key = await unismsKey();
  if (key === "") return { error: "UniSMS secret key is not set (Admin > Settings)." };
  const base = unismsBase();
  const auth = Buffer.from(`${key}:`).toString("base64");
  const rows: UpstreamMessage[] = [];
  for (const recipient of numbers) {
    let res: Response;
    try {
      res = await fetch(`${base}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
        body: JSON.stringify({ recipient, content: message, sender_id: senderName }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (e) {
      return { error: `UniSMS connection error: ${e instanceof Error ? e.message : "unknown"}` };
    }
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (data as { message?: unknown; error?: unknown } | null)?.message ??
        (data as { error?: unknown } | null)?.error ??
        `HTTP ${res.status}`;
      return { error: typeof msg === "string" ? msg : `HTTP ${res.status}`, raw: data };
    }
    const m = (
      data as { message?: { reference_id?: unknown; status?: unknown; recipient?: unknown; sender_id?: unknown } } | null
    )?.message;
    if (!m || typeof m.reference_id !== "string" || m.reference_id === "") {
      return { error: "Unexpected UniSMS response", raw: data };
    }
    rows.push({
      provider_ref: m.reference_id,
      recipient: typeof m.recipient === "string" ? m.recipient : recipient,
      message,
      sender_name: typeof m.sender_id === "string" ? m.sender_id : senderName,
      status: typeof m.status === "string" ? m.status : "pending",
      type: "Single",
    });
  }
  return rows;
}

/** Fallback sender: admin setting, else SMMSOFT (PHP upstream_sender). */
export async function upstreamSender(): Promise<string> {
  const s = (await settingGet("default_sender", "")).trim();
  return s !== "" ? s : "SMMSOFT";
}

async function upstreamCall(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string> = {},
): Promise<UpstreamResult> {
  const key = await upstreamKey();
  if (key === "") return { error: "Upstream API key is not set (Admin > Settings)." };
  const url = `${SEMAPHORE_BASE}/${path.replace(/^\/+/, "")}`;
  try {
    let res: Response;
    if (method === "POST") {
      const body = new URLSearchParams({ ...params, apikey: key });
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(60000),
      });
    } else {
      const qs = new URLSearchParams({ ...params, apikey: key });
      res = await fetch(`${url}?${qs.toString()}`, { signal: AbortSignal.timeout(60000) });
    }
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (data as { message?: unknown; error?: unknown } | null)?.message ??
        (data as { error?: unknown } | null)?.error ??
        `HTTP ${res.status}`;
      return { error: typeof msg === "string" ? msg : `HTTP ${res.status}`, raw: data };
    }
    if (Array.isArray(data)) return data as UpstreamMessage[];
    if (data && typeof data === "object") return [data as UpstreamMessage];
    return { error: `Unexpected upstream response (HTTP ${res.status})` };
  } catch (e) {
    return { error: `Upstream connection error: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

export async function upstreamSend(
  numbers: string[],
  message: string,
  kind: "regular" | "priority" | "otp" = "regular",
  code: string | null = null,
  sender: string | null = null,
): Promise<UpstreamResult> {
  const senderName = sender !== null && sender.trim() !== "" ? sender.trim() : await upstreamSender();
  if (mockEnabled()) {
    return mockSend(numbers, message, kind, code, senderName);
  }
  if ((await upstreamProvider()) === "unisms") {
    return unismsSend(numbers, message, senderName);
  }
  const path = kind === "priority" ? "priority" : kind === "otp" ? "otp" : "messages";
  const params: Record<string, string> = {
    number: numbers.join(","),
    message,
  };
  if (senderName !== "") params.sendername = senderName;
  if (kind === "otp" && code !== null && code !== "") params.code = code;
  return upstreamCall("POST", path, params);
}

export async function upstreamAccount(): Promise<{ credit_balance?: number; error?: string }> {
  if (mockEnabled()) return mockAccount();
  // UniSMS documents no balance endpoint — never invent one. Callers
  // (upstreamBalance) treat this error as "no live balance".
  if ((await upstreamProvider()) === "unisms") {
    return { error: "UniSMS does not expose a balance endpoint — check your balance on unismsapi.com." };
  }
  const res = await upstreamCall("GET", "account");
  if (isError(res)) return { error: res.error };
  const first = res[0] as unknown as { credit_balance?: number } | undefined;
  return { credit_balance: first?.credit_balance };
}

export async function upstreamMessage(id: number): Promise<UpstreamMessage | { error: string }> {
  if (mockEnabled()) {
    const row: MockMessageRow = mockMessage(id);
    return row;
  }
  const res = await upstreamCall("GET", `messages/${id}`);
  if (isError(res)) return { error: res.error };
  const one = res[0];
  return one ?? { error: "Message not found upstream." };
}

/** Upstream (Semaphore) balance, cached 2 min — informational for the admin.
 *  For UniSMS this is always null: no balance endpoint exists, and a stale
 *  cached Semaphore number must never be shown as the upstream balance. */
export async function upstreamBalance(force = false): Promise<number | null> {
  if ((await upstreamProvider()) === "unisms") return null;
  const cachedAt = parseInt(await settingGet("balance_cached_at", "0"), 10) || 0;
  if (!force && Date.now() / 1000 - cachedAt < 120) {
    const c = await settingGet("balance_cache", "");
    return c === "" ? null : parseFloat(c);
  }
  const acc = await upstreamAccount();
  if (typeof acc.credit_balance === "number") {
    await settingSet("balance_cache", String(acc.credit_balance));
    await settingSet("balance_cached_at", String(Math.floor(Date.now() / 1000)));
    return acc.credit_balance;
  }
  const c = await settingGet("balance_cache", "");
  return c === "" ? null : parseFloat(c);
}
