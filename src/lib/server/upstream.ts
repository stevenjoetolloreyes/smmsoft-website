import "server-only";
import { settingGet, settingSet } from "../settings";
import { mockAccount, mockEnabled, mockMessage, mockSend, type MockMessageRow } from "./mock";

const SEMAPHORE_BASE = "https://api.semaphore.co/api/v4";

export type UpstreamMessage = {
  message_id: number;
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

/** Upstream (Semaphore) balance, cached 2 min — informational for the admin. */
export async function upstreamBalance(force = false): Promise<number | null> {
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
