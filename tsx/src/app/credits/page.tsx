import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import AppShell, { StatusPill } from "@/components/AppShell";
import TopupForm from "@/components/customer/TopupForm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { creditTransactions, topups } from "@/lib/schema";
import { settingFloat, settingGet, settingInt } from "@/lib/settings";
import { formatDateTime, formatInt, formatPeso, userCredits } from "@/lib/sms";

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = (await searchParams) ?? {};
  const initialCredits = firstParam(sp.credits);
  const page = Math.max(1, parseInt(firstParam(sp.page), 10) || 1);
  const per = 25;
  const off = (page - 1) * per;

  const db = await getDb();
  const price = await settingFloat("price_per_credit", 0.65);
  const costRegular = await settingInt("cost_regular", 1);
  const costPriority = await settingInt("cost_priority", 2);
  const costOtp = await settingInt("cost_otp", 2);
  const instructions = await settingGet("payment_instructions", "");
  const balance = await userCredits(session.id);
  const myTopups = await db
    .select()
    .from(topups)
    .where(eq(topups.userId, session.id))
    .orderBy(desc(topups.id))
    .limit(10);
  const totalRows = await db
    .select({ v: count() })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, session.id));
  const total = totalRows[0]?.v ?? 0;
  const txns = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, session.id))
    .orderBy(desc(creditTransactions.id))
    .limit(per)
    .offset(off);
  const pages = Math.max(1, Math.ceil(total / per));

  return (
    <AppShell title="Credits" active="credits" user={session}>
      <div className="cards">
        <div className="card">
          <div className="k">
            <i className="fa-solid fa-coins" /> Balance
          </div>
          <div className="v">{formatInt(balance)} credits</div>
          <div className="s">{formatPeso(price)} per credit</div>
        </div>
        <div className="card">
          <div className="k">
            <i className="fa-solid fa-paper-plane" /> Regular SMS
          </div>
          <div className="v">{costRegular} credit</div>
          <div className="s">per 160-char part, per recipient</div>
        </div>
        <div className="card">
          <div className="k">
            <i className="fa-solid fa-bolt" /> Priority
          </div>
          <div className="v">{costPriority} credits</div>
          <div className="s">per part, skips the queue</div>
        </div>
        <div className="card">
          <div className="k">
            <i className="fa-solid fa-key" /> OTP
          </div>
          <div className="v">{costOtp} credits</div>
          <div className="s">per part, dedicated route</div>
        </div>
      </div>
      <div className="grid2">
        <div className="panel">
          <h2>
            <i className="fa-solid fa-cart-plus" /> Buy Credits
          </h2>
          <p className="hint">
            {instructions.split("\n").map((line, i) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))}
          </p>
          <TopupForm price={price} balance={balance} initialCredits={initialCredits} />
          {myTopups.length > 0 && (
            <>
              <h2 className="mt">
                <i className="fa-solid fa-clock-rotate-left" /> My Requests
              </h2>
              <table>
                <tbody>
                  <tr>
                    <th>Credits</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                  {myTopups.map((t) => (
                    <tr key={t.id}>
                      <td>{formatInt(t.creditsWanted)}</td>
                      <td>{formatPeso(t.amountPeso)}</td>
                      <td>{t.payRef ?? "—"}</td>
                      <td>
                        <StatusPill status={t.status} />
                      </td>
                      <td>{formatDateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="panel">
          <h2>
            <i className="fa-solid fa-receipt" /> Credit History
          </h2>
          {txns.length === 0 ? (
            <p className="hint">No transactions yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <tbody>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Note</th>
                    <th>When</th>
                  </tr>
                  {txns.map((t) => (
                    <tr key={t.id}>
                      <td>{t.type.charAt(0).toUpperCase() + t.type.slice(1)}</td>
                      <td>
                        {t.amount >= 0 ? "+" : ""}
                        {t.amount}
                      </td>
                      <td>{formatInt(t.balanceAfter)}</td>
                      <td>{t.note ?? ""}</td>
                      <td>{formatDateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="rowflex mt">
            {page > 1 && (
              <Link className="btn ghost small" href={`/credits?page=${page - 1}`}>
                Prev
              </Link>
            )}
            <span className="hint">
              Page {page} of {pages} · {formatInt(total)} transaction(s)
            </span>
            {page < pages && (
              <Link className="btn ghost small" href={`/credits?page=${page + 1}`}>
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
