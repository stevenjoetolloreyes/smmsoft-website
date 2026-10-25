import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc, count, desc, eq, sql } from 'drizzle-orm';
import AppShell, { StatusPill } from '@/components/AppShell';
import {
  AdjustForm,
  PlatformSettingsForm,
  SenderAddForm,
  SenderRowButtons,
  StatusButton,
  TopupDecideButtons,
} from '@/components/admin/AdminForms';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { creditTransactions, smsMessages, smsSenders, topups, users } from '@/lib/schema';
import { upstreamKey } from '@/lib/server/upstream';
import { upstreamBalance } from '@/lib/server/upstream';
import { settingGet } from '@/lib/settings';
import { formatDateTime, formatInt } from '@/lib/sms';

const TABS = [
  { k: 'overview', label: 'Overview' },
  { k: 'users', label: 'Users' },
  { k: 'topups', label: 'Top-ups' },
  { k: 'messages', label: 'All Messages' },
  { k: 'senders', label: 'Sender Names' },
  { k: 'settings', label: 'Platform Settings' },
] as const;

type TabKey = (typeof TABS)[number]['k'];

const USERS_PER_PAGE = 25;

function truncate(s: string, n = 50): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect('/login');
  const params = await searchParams;
  const tab: TabKey = TABS.some((t) => t.k === params.tab) ? (params.tab as TabKey) : 'overview';
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const db = await getDb();

  // ---- Data per tab (mirrors admin.php) ----
  let overview: {
    customers: number;
    msgs: number;
    sent: number;
    creditsConsumed: number;
    pendingTopups: number;
    upBal: number | null;
  } | null = null;
  if (tab === 'overview') {
    const [custRows, msgRows, sentRows, consumedRows, pendRows] = await Promise.all([
      db.select({ n: count() }).from(users).where(eq(users.isAdmin, 0)),
      db.select({ n: count() }).from(smsMessages),
      db.select({ n: count() }).from(smsMessages).where(eq(smsMessages.status, 'Sent')),
      db
        .select({ total: sql<number>`coalesce(sum(-${creditTransactions.amount}), 0)` })
        .from(creditTransactions)
        .where(eq(creditTransactions.type, 'send')),
      db.select({ n: count() }).from(topups).where(eq(topups.status, 'pending')),
    ]);
    const key = await upstreamKey();
    const upBal = key !== '' ? await upstreamBalance() : null;
    overview = {
      customers: custRows[0]?.n ?? 0,
      msgs: msgRows[0]?.n ?? 0,
      sent: sentRows[0]?.n ?? 0,
      creditsConsumed: Number(consumedRows[0]?.total ?? 0),
      pendingTopups: pendRows[0]?.n ?? 0,
      upBal,
    };
  }

  let userRows: typeof users.$inferSelect[] = [];
  let userPages = 1;
  if (tab === 'users') {
    const [totalRows, rows] = await Promise.all([
      db.select({ n: count() }).from(users),
      db
        .select()
        .from(users)
        .orderBy(desc(users.isAdmin), asc(users.id))
        .limit(USERS_PER_PAGE)
        .offset((page - 1) * USERS_PER_PAGE),
    ]);
    userRows = rows;
    userPages = Math.max(1, Math.ceil((totalRows[0]?.n ?? 0) / USERS_PER_PAGE));
  }

  let topupRows: {
    id: number;
    creditsWanted: number;
    amountPeso: number;
    payRef: string | null;
    status: string;
    createdAt: Date;
    userName: string;
    userEmail: string;
  }[] = [];
  if (tab === 'topups') {
    const rows = await db
      .select({
        id: topups.id,
        creditsWanted: topups.creditsWanted,
        amountPeso: topups.amountPeso,
        payRef: topups.payRef,
        status: topups.status,
        createdAt: topups.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(topups)
      .innerJoin(users, eq(users.id, topups.userId))
      .orderBy(
        sql`CASE WHEN ${topups.status} = 'pending' THEN 0 ELSE 1 END`,
        desc(topups.id),
      )
      .limit(50);
    topupRows = rows;
  }

  let messageRows: {
    id: number;
    email: string;
    recipient: string;
    message: string;
    senderName: string | null;
    status: string;
    creditsCharged: number;
    when: Date | null;
  }[] = [];
  if (tab === 'messages') {
    const rows = await db
      .select({
        id: smsMessages.id,
        email: users.email,
        recipient: smsMessages.recipient,
        message: smsMessages.message,
        senderName: smsMessages.senderName,
        status: smsMessages.status,
        creditsCharged: smsMessages.creditsCharged,
        createdAt: smsMessages.createdAt,
        loggedAt: smsMessages.loggedAt,
      })
      .from(smsMessages)
      .innerJoin(users, eq(users.id, smsMessages.userId))
      .orderBy(desc(smsMessages.id))
      .limit(100);
    messageRows = rows.map((m) => ({
      ...m,
      when: m.createdAt ?? m.loggedAt,
    }));
  }

  let senderRows: typeof smsSenders.$inferSelect[] = [];
  if (tab === 'senders') {
    senderRows = await db
      .select()
      .from(smsSenders)
      .orderBy(desc(smsSenders.isDefault), asc(smsSenders.name));
  }

  let settingsInitial: {
    defaultSender: string;
    pricePerCredit: string;
    costRegular: string;
    costPriority: string;
    costOtp: string;
    welcomeCredits: string;
    paymentInstructions: string;
    upstreamConfigured: boolean;
  } | null = null;
  if (tab === 'settings') {
    const [defaultSender, pricePerCredit, costRegular, costPriority, costOtp, welcomeCredits, paymentInstructions, storedKey] =
      await Promise.all([
        settingGet('default_sender', 'SMMSOFT'),
        settingGet('price_per_credit', '0.65'),
        settingGet('cost_regular', '1'),
        settingGet('cost_priority', '2'),
        settingGet('cost_otp', '2'),
        settingGet('welcome_credits', '0'),
        settingGet('payment_instructions', ''),
        settingGet('upstream_api_key', ''),
      ]);
    const envKey = (process.env.SEMAPHORE_API_KEY ?? '').trim();
    settingsInitial = {
      defaultSender,
      pricePerCredit,
      costRegular,
      costPriority,
      costOtp,
      welcomeCredits,
      paymentInstructions,
      // Boolean only — never the key, and never which source holds it.
      upstreamConfigured: envKey !== '' || storedKey.trim() !== '',
    };
  }

  return (
    <AppShell title="Admin Panel" active="admin" user={admin}>
      <div className="tabs">
        {TABS.map((t) => (
          <Link key={t.k} href={`/admin?tab=${t.k}`} className={tab === t.k ? 'on' : ''}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <div className="cards">
          <div className="card">
            <div className="k">
              <i className="fa-solid fa-users" /> Customers
            </div>
            <div className="v">{formatInt(overview.customers)}</div>
            <div className="s">{overview.pendingTopups} top-up(s) waiting</div>
          </div>
          <div className="card">
            <div className="k">
              <i className="fa-solid fa-envelope" /> Messages (all)
            </div>
            <div className="v">{formatInt(overview.msgs)}</div>
            <div className="s">{formatInt(overview.sent)} sent</div>
          </div>
          <div className="card">
            <div className="k">
              <i className="fa-solid fa-coins" /> Credits consumed
            </div>
            <div className="v">{formatInt(overview.creditsConsumed)}</div>
            <div className="s">across all customers</div>
          </div>
          <div className="card">
            <div className="k">
              <i className="fa-solid fa-tower-broadcast" /> Upstream balance
            </div>
            <div className="v">{overview.upBal === null ? '—' : formatInt(overview.upBal)}</div>
            <div className="s">your wholesale Semaphore credits</div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="panel">
          <h2>
            <i className="fa-solid fa-users" /> Users
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Adjust credits</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((x) => (
                  <tr key={x.id}>
                    <td>{x.id}</td>
                    <td>
                      {x.name}
                      {x.isAdmin === 1 ? ' (admin)' : ''}
                    </td>
                    <td>{x.email}</td>
                    <td>{formatInt(x.credits)}</td>
                    <td>
                      <StatusPill status={x.status} />
                    </td>
                    <td>
                      <AdjustForm userId={x.id} />
                    </td>
                    <td>{x.isAdmin === 0 ? <StatusButton userId={x.id} status={x.status} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {userPages > 1 && (
            <div className="rowflex mt">
              {page > 1 && (
                <Link className="btn ghost small" href={`/admin?tab=users&page=${page - 1}`}>
                  Previous
                </Link>
              )}
              <span className="small">
                Page {page} of {userPages}
              </span>
              {page < userPages && (
                <Link className="btn ghost small" href={`/admin?tab=users&page=${page + 1}`}>
                  Next
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'topups' && (
        <div className="panel">
          <h2>
            <i className="fa-solid fa-money-bill-wave" /> Top-up Requests
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Credits</th>
                  <th>Amount</th>
                  <th>Payment ref</th>
                  <th>Status</th>
                  <th>When</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {topupRows.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>
                      {t.userName}
                      <br />
                      <span className="hint">{t.userEmail}</span>
                    </td>
                    <td>{formatInt(t.creditsWanted)}</td>
                    <td>₱{t.amountPeso.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="mono">{t.payRef ?? ''}</td>
                    <td>
                      <StatusPill status={t.status} />
                    </td>
                    <td>{formatDateTime(t.createdAt)}</td>
                    <td>{t.status === 'pending' ? <TopupDecideButtons topupId={t.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div className="panel">
          <h2>
            <i className="fa-solid fa-envelope-open-text" /> Latest 100 messages (all users)
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Recipient</th>
                  <th>Message</th>
                  <th>Sender</th>
                  <th>Status</th>
                  <th>Credits</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {messageRows.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email}</td>
                    <td>{m.recipient}</td>
                    <td>{truncate(m.message)}</td>
                    <td className="mono">{m.senderName ?? ''}</td>
                    <td>
                      <StatusPill status={m.status} />
                    </td>
                    <td>{m.creditsCharged}</td>
                    <td>{formatDateTime(m.when)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'senders' && (
        <div className="panel">
          <h2>
            <i className="fa-solid fa-signature" /> Sender Name Pool
          </h2>
          <p className="hint">
            Every customer picks a sender name from this pool when sending — on the web pages
            and through the API. A name only works once it is <b>approved on your Semaphore
            account</b> (max 11 characters, letters and numbers) — adding it here does not
            approve it upstream, so add names here only after the upstream approval comes through.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Sender name</th>
                  <th>Default</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {senderRows.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.name}</td>
                    <td>{s.isDefault === 1 ? <span className="pill ok">Default</span> : ''}</td>
                    <td>
                      <SenderRowButtons senderId={s.id} senderName={s.name} isDefault={s.isDefault === 1} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SenderAddForm />
        </div>
      )}

      {tab === 'settings' && settingsInitial && (
        <div className="panel">
          <h2>
            <i className="fa-solid fa-sliders" /> Platform Settings
          </h2>
          <PlatformSettingsForm initial={settingsInitial} />
        </div>
      )}
    </AppShell>
  );
}
