import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { senderDefault, sendersPool } from '@/lib/server/send';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = req.headers.get('x-api-key') ?? url.searchParams.get('apikey') ?? '';
  if (key === '') {
    return NextResponse.json({ ok: false, error: 'Missing apikey.' }, { status: 401 });
  }
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.apiKey, key)).limit(1);
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid apikey.' }, { status: 401 });
  }
  const [senders, defaultSender] = await Promise.all([sendersPool(), senderDefault()]);
  return NextResponse.json({
    ok: true,
    account_name: user.name,
    email: user.email,
    status: user.status,
    credit_balance: user.credits,
    senders,
    default_sender: defaultSender,
  });
}
