import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import AppShell, { StatusPill } from "@/components/AppShell";
import DashboardTopup from "@/components/customer/DashboardTopup";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { smsContacts, smsMessages } from "@/lib/schema";
import { senderDefault } from "@/lib/server/send";
import { settingFloat } from "@/lib/settings";
import { formatDateTime, formatInt, formatPeso, userCredits } from "@/lib/sms";
import {ArrowRight, ChartColumn, ChartLine, Coins, ContactRound, History, KeyRound, Mail, MailOpen, PlusCircle, Send, Users, Wallet} from "lucide-react";

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const db = await getDb();
  const uid = session.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const countWhere = async (where: ReturnType<typeof and> | ReturnType<typeof eq>) => {
    const rows = await db.select({ v: count() }).from(smsMessages).where(where);
    return rows[0]?.v ?? 0;
  };
  const total = await countWhere(eq(smsMessages.userId, uid));
  const today = await countWhere(
    and(eq(smsMessages.userId, uid), gte(smsMessages.loggedAt, dayStart), lt(smsMessages.loggedAt, dayEnd)),
  );
  const inflight = await countWhere(
    and(eq(smsMessages.userId, uid), inArray(smsMessages.status, ["Queued", "Pending"])),
  );
  const failed = await countWhere(and(eq(smsMessages.userId, uid), eq(smsMessages.status, "Failed")));
  const sentMonth = await countWhere(
    and(
      eq(smsMessages.userId, uid),
      eq(smsMessages.status, "Sent"),
      gte(smsMessages.loggedAt, monthStart),
      lt(smsMessages.loggedAt, monthEnd),
    ),
  );
  const monthRows = await db
    .select({ credits: smsMessages.creditsCharged })
    .from(smsMessages)
    .where(and(eq(smsMessages.userId, uid), gte(smsMessages.loggedAt, monthStart), lt(smsMessages.loggedAt, monthEnd)));
  const usedMonth = monthRows.reduce((sum, r) => sum + (r.credits ?? 0), 0);
  const contactsRows = await db.select({ v: count() }).from(smsContacts).where(eq(smsContacts.userId, uid));
  const contactsCount = contactsRows[0]?.v ?? 0;
  const recent = await db
    .select()
    .from(smsMessages)
    .where(eq(smsMessages.userId, uid))
    .orderBy(desc(smsMessages.id))
    .limit(10);

  const credits = await userCredits(uid);
  const price = await settingFloat("price_per_credit", 0.65);
  const sender = await senderDefault();
  const monthName = now.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

  return (
    <AppShell title="Dashboard" active="dashboard" user={session}>
      <p className="page-sub">Your balance, usage this month and quick links.</p>
      <div className="quicklinks">
        <Link className="btn" href="/send">
          <Send aria-hidden="true" /> Send SMS
        </Link>
        <Link className="btn ghost" href="/api-access">
          <KeyRound aria-hidden="true" /> API key
        </Link>
        <Link className="btn ghost" href="/credits">
          <Wallet aria-hidden="true" /> Buy credits
        </Link>
      </div>
      <div className="banner">
        <ContactRound aria-hidden="true" />
        <span>
          Your messages go out under the sender name <b>{sender}</b>, on Globe, Smart, DITO, Sun, TNT and TM.
        </span>
      </div>
      <div className="cards">
        <div className="card">
          <div className="k">
            <Coins aria-hidden="true" /> Credits Balance
          </div>
          <div className="v">{formatInt(credits)}</div>
          <div className="s">≈ {formatPeso(credits * price)} worth of SMS</div>
          <Link className="card-link" href="/credits">
            Buy credits <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div className="card">
          <div className="k">
            <Mail aria-hidden="true" /> Sent This Month
          </div>
          <div className="v">{formatInt(sentMonth)}</div>
          <div className="s">
            {formatInt(today)} sent today · {formatInt(total)} all time
          </div>
          <Link className="card-link" href="/messages">
            Messages <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div className="card">
          <div className="k">
            <ChartColumn aria-hidden="true" /> Credits Used This Month
          </div>
          <div className="v">{formatInt(usedMonth)}</div>
          <div className="s">
            {formatInt(inflight)} queued / in flight · {formatInt(failed)} failed
          </div>
          <Link className="card-link" href="/credits">
            Credit history <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div className="card">
          <div className="k">
            <Users aria-hidden="true" /> Contacts
          </div>
          <div className="v">{formatInt(contactsCount)}</div>
          <div className="s">saved numbers and groups</div>
          <Link className="card-link" href="/contacts">
            Contacts <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="grid2">
        <div className="panel">
          <h2>
            <PlusCircle aria-hidden="true" /> Top Up Credits
          </h2>
          <p className="hint">Credits are added once your GCash payment is verified. Top-ups are confirmed by the admin — no card needed.</p>
          <DashboardTopup price={price} balance={credits} />
        </div>
        <div className="panel">
          <h2>
            <ChartLine aria-hidden="true" /> SMS &amp; Credits · {monthName}
          </h2>
          <ul className="breakdown">
            <li>
              <span>Sent this month</span>
              <b>{formatInt(sentMonth)}</b>
            </li>
            <li>
              <span>Credits used this month</span>
              <b>{formatInt(usedMonth)}</b>
            </li>
            <li>
              <span>Failed (all time)</span>
              <b>{formatInt(failed)}</b>
            </li>
            <li>
              <span>Queued / in flight</span>
              <b>{formatInt(inflight)}</b>
            </li>
          </ul>
          <p className="hint">Failed messages are refunded to your balance when the network reports them as failed.</p>
          <div className="mt">
            <Link className="btn ghost" href="/messages">
              <MailOpen aria-hidden="true" /> Open message history
            </Link>
          </div>
        </div>
      </div>
      <div className="panel">
        <h2>
          <History aria-hidden="true" /> Recent Messages
        </h2>
        {recent.length === 0 ? (
          <p className="hint">
            No messages yet. Send your first one from <Link href="/send">Send SMS</Link>.
          </p>
        ) : (
          <div className="tablewrap">
            <table>
              <tbody>
                <tr>
                  <th>Recipient</th>
                  <th>Message</th>
                  <th>Network</th>
                  <th>Status</th>
                  <th>Credits</th>
                  <th>When</th>
                </tr>
                {recent.map((m) => (
                  <tr key={m.id}>
                    <td>{m.recipient}</td>
                    <td>{truncate(m.message, 60)}</td>
                    <td>{m.network || "—"}</td>
                    <td>
                      <StatusPill status={m.status} />
                    </td>
                    <td>{m.creditsCharged}</td>
                    <td>{formatDateTime(m.createdAt ?? m.loggedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
