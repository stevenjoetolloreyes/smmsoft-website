import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { smmsoftSend } from '@/lib/server/send';
import { phNormalize, userCredits } from '@/lib/sms';

type Body = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
}

/** PHP reads $_POST first, else JSON — mirror that precedence. */
async function readBody(req: Request): Promise<Body> {
  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const out: Body = {};
      form.forEach((v, k) => {
        out[k] = typeof v === 'string' ? v : '';
      });
      return out;
    }
    if (contentType.includes('application/json')) {
      const data: unknown = await req.json().catch(() => null);
      return data && typeof data === 'object' ? (data as Body) : {};
    }
    // No (or unknown) content type: try form first, then JSON, like PHP's
    // $_POST-fallback-to-php://input behaviour.
    const text = await req.text();
    if (!text) return {};
    const form = new URLSearchParams(text);
    if ([...form.keys()].length > 0) {
      const out: Body = {};
      form.forEach((v, k) => {
        out[k] = v;
      });
      return out;
    }
    const data: unknown = JSON.parse(text);
    return data && typeof data === 'object' ? (data as Body) : {};
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const body = await readBody(req);
  const key = req.headers.get('x-api-key') ?? asString(body.apikey);
  if (key === '') {
    return NextResponse.json({ ok: false, error: 'Missing apikey.' }, { status: 401 });
  }
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.apiKey, key)).limit(1);
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid apikey.' }, { status: 401 });
  }
  if (user.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'Account is suspended.' }, { status: 403 });
  }

  const message = asString(body.message).trim();
  const kindRaw = asString(body.kind) || 'regular';
  if (kindRaw !== 'regular' && kindRaw !== 'priority' && kindRaw !== 'otp') {
    return NextResponse.json(
      { ok: false, error: 'Invalid kind. Use regular, priority, or otp.' },
      { status: 422 },
    );
  }
  const kind = kindRaw as 'regular' | 'priority' | 'otp';
  // PHP accepts a comma/newline-separated list (up to 1000/call); normalize
  // each entry, drop invalids, dedupe. Same error when none are valid.
  const numbers = [
    ...new Set(
      asString(body.number)
        .split(/[\n,]+/)
        .map((n) => phNormalize(n.trim()))
        .filter((n): n is string => n !== null),
    ),
  ].slice(0, 1000);
  if (numbers.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No valid PH numbers (09xxxxxxxxx).' },
      { status: 422 },
    );
  }
  if (message === '') {
    return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 422 });
  }
  if (message.toUpperCase().startsWith('TEST')) {
    return NextResponse.json(
      { ok: false, error: 'Messages starting with TEST are ignored by the network.' },
      { status: 422 },
    );
  }

  const senderRaw = asString(body.sender).trim();
  const sender = senderRaw === '' ? null : senderRaw;
  const otpCodeRaw = asString(body.otp_code);
  const otpCode = otpCodeRaw === '' ? null : otpCodeRaw;

  const res = await smmsoftSend(user.id, numbers, message, kind, otpCode, 'api', sender);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.httpStatus });
  }
  const balance = await userCredits(user.id);
  return NextResponse.json({
    ok: true,
    sent: res.sent,
    cost: res.cost,
    balance,
    sender: res.sender,
    message_ids: res.message_ids,
  });
}
