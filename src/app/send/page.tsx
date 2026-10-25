import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import SendForm from "@/components/customer/SendForm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { smsContacts } from "@/lib/schema";
import { sendersPool, senderDefault } from "@/lib/server/send";
import { settingInt } from "@/lib/settings";
import { userCredits } from "@/lib/sms";

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function SendPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = (await searchParams) ?? {};
  const group = firstParam(sp.group);
  const to = firstParam(sp.to);
  let prefill = "";
  if (group !== "") {
    const db = await getDb();
    const members = await db
      .select({ number: smsContacts.number })
      .from(smsContacts)
      .where(and(eq(smsContacts.userId, session.id), eq(smsContacts.groupName, group)))
      .orderBy(asc(smsContacts.name));
    prefill = members.map((r) => r.number).join("\n");
  }
  if (to !== "") prefill = to;

  const pool = await sendersPool();
  const def = await senderDefault();
  const costs = {
    regular: await settingInt("cost_regular", 1),
    priority: await settingInt("cost_priority", 2),
    otp: await settingInt("cost_otp", 2),
  };
  const balance = await userCredits(session.id);

  return (
    <AppShell title="Send SMS" active="send" user={session}>
      <p className="page-sub">Send an SMS to one or many mobile numbers.</p>
      <div className="tabs">
        <Link href="/send" className="on">
          Single message
        </Link>
        <Link href="/bulk">Bulk via CSV</Link>
      </div>
      <div className="send-grid">
        <div className="panel">
          <h2>
            <i className="fa-solid fa-pen-to-square" /> Message Details
          </h2>
          <SendForm senders={pool} defaultSender={def} costs={costs} balance={balance} prefill={prefill} />
        </div>
        <div className="send-side">
          <div className="panel">
            <h2>
              <i className="fa-solid fa-layer-group" /> Message Types
            </h2>
            <ul className="type-list">
              <li>
                <b>Regular</b>
                <span>{costs.regular} credit per part — everyday announcements and updates.</span>
              </li>
              <li>
                <b>Priority</b>
                <span>{costs.priority} credits per part — skips the regular queue for urgent alerts.</span>
              </li>
              <li>
                <b>OTP</b>
                <span>{costs.otp} credits per part — dedicated route for codes. Write {"{otp}"} where the code goes.</span>
              </li>
            </ul>
            <p className="hint">One part is 160 characters; longer messages continue at 153 characters per part.</p>
          </div>
          <div className="panel">
            <h2>
              <i className="fa-solid fa-shield-halved" /> Tips for Clean Delivery
            </h2>
            <ul className="tips">
              <li>Write clearly, like a message from your business — proper words, normal capitalization.</li>
              <li>Avoid ALL-CAPS text and long strings of symbols; networks read them as spam.</li>
              <li>Say who you are in the message when it matters (&quot;This is Ana from…&quot;).</li>
              <li>Send promos only to customers who agreed to receive them.</li>
              <li>Keep it under 160 characters when you can — one part, one credit.</li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
