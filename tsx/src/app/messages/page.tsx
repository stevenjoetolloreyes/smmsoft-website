import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, like, or } from "drizzle-orm";
import AppShell, { StatusPill } from "@/components/AppShell";
import RefreshButton from "@/components/customer/RefreshButton";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { smsMessages } from "@/lib/schema";
import { formatDateTime } from "@/lib/sms";

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const STATUSES = ["Queued", "Pending", "Sent", "Failed", "Refunded"];

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = (await searchParams) ?? {};
  const status = firstParam(sp.status);
  const q = firstParam(sp.q);
  const page = Math.max(1, parseInt(firstParam(sp.page), 10) || 1);
  const per = 25;
  const off = (page - 1) * per;

  const db = await getDb();
  const conditions = [eq(smsMessages.userId, session.id)];
  if (status !== "") conditions.push(eq(smsMessages.status, status));
  if (q !== "") {
    const pat = `%${q}%`;
    conditions.push(or(like(smsMessages.recipient, pat), like(smsMessages.message, pat))!);
  }
  const where = and(...conditions);
  const totalRows = await db.select({ v: count() }).from(smsMessages).where(where);
  const total = totalRows[0]?.v ?? 0;
  const rows = await db
    .select()
    .from(smsMessages)
    .where(where)
    .orderBy(desc(smsMessages.id))
    .limit(per)
    .offset(off);
  const pages = Math.max(1, Math.ceil(total / per));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (status !== "") params.set("status", status);
    if (q !== "") params.set("q", q);
    return `/messages?${params.toString()}`;
  };

  return (
    <AppShell title="Messages" active="messages" user={session}>
      <div className="panel">
        <form method="get" className="rowflex">
          <select name="status" style={{ width: "auto" }} defaultValue={status}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input type="text" name="q" placeholder="Search number or message" defaultValue={q} style={{ width: 220 }} />
          <button className="btn small" type="submit">
            <i className="fa-solid fa-magnifying-glass" /> Filter
          </button>
        </form>
        <div className="mt">
          <RefreshButton />
        </div>
        <div style={{ overflowX: "auto" }} className="mt">
          <table>
            <tbody>
              <tr>
                <th>ID</th>
                <th>Recipient</th>
                <th>Sender</th>
                <th>Message</th>
                <th>Network</th>
                <th>Status</th>
                <th>Credits</th>
                <th>Via</th>
                <th>When</th>
              </tr>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="hint">
                    No messages found.
                  </td>
                </tr>
              )}
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.semaphoreId ?? "—"}</td>
                  <td>{m.recipient}</td>
                  <td>{m.senderName || "—"}</td>
                  <td>{truncate(m.message, 70)}</td>
                  <td>{m.network || "—"}</td>
                  <td>
                    <StatusPill status={m.status} />
                  </td>
                  <td>{m.creditsCharged}</td>
                  <td>{m.source}</td>
                  <td>{formatDateTime(m.createdAt ?? m.loggedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rowflex mt">
          {page > 1 && (
            <Link className="btn ghost small" href={pageHref(page - 1)}>
              Prev
            </Link>
          )}
          <span className="hint">
            Page {page} of {pages} · {total.toLocaleString("en-PH")} message(s)
          </span>
          {page < pages && (
            <Link className="btn ghost small" href={pageHref(page + 1)}>
              Next
            </Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}
