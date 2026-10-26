import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { senderDefault } from "@/lib/server/send";
import { settingFloat, settingGet, settingInt } from "@/lib/settings";
import { formatPeso } from "@/lib/sms";
import {Code, Coins, FileSpreadsheet, History, KeyRound, RadioTower, Rocket, Send, Signature, Users, Wallet, Zap} from "lucide-react";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const price = await settingFloat("price_per_credit", 0.65);
  const cR = await settingInt("cost_regular", 1);
  const cP = await settingInt("cost_priority", 2);
  const cO = await settingInt("cost_otp", 2);
  const sender = await senderDefault();
  const payNote = (await settingGet("payment_instructions", "")).trim();

  return (
    <div className="landing">
      <header className="land-nav">
        <div className="brand">
          <RadioTower aria-hidden="true" /> SMS SOFT
        </div>
        <div className="rowflex">
          <Link className="btn ghost small" href="/login">
            Login
          </Link>
          <Link className="btn small" href="/register">
            Create account
          </Link>
        </div>
      </header>

      <section className="hero">
        <h1>
          Send SMS to any Philippine number —<br />
          from one simple dashboard.
        </h1>
        <p>
          Bulk messages, priority delivery, and OTP — with a developer API your apps can call. Sender name: <b>{sender}</b> by
          default — or pick another from the approved pool each time you send. Credits never complicated: 1 regular SMS = {cR}{" "}
          credit{cR > 1 ? "s" : ""} per recipient.
        </p>
        <div className="rowflex mt">
          <Link className="btn" href="/register">
            <Rocket aria-hidden="true" /> Start sending
          </Link>
          <Link className="btn ghost" href="/login">
            I already have an account
          </Link>
        </div>
        <p className="s" style={{ marginTop: 14 }}>
          Globe · Smart · TNT · DITO · Sun supported &nbsp;·&nbsp; No setup fee &nbsp;·&nbsp; No monthly fee
        </p>
      </section>

      <section className="cards">
        <div className="card">
          <div className="k">
            <Send aria-hidden="true" /> Web Sender
          </div>
          <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
            Send from the dashboard to one number or thousands at once. Live credit counter while you type.
          </div>
        </div>
        <div className="card">
          <div className="k">
            <Zap aria-hidden="true" /> Priority &amp; OTP
          </div>
          <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
            Time-sensitive messages skip the queue ({cP} credits). Dedicated OTP route with auto-generated codes ({cO} credits).
          </div>
        </div>
        <div className="card">
          <div className="k">
            <Code aria-hidden="true" /> Developer API
          </div>
          <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
            One POST request sends an SMS. Your API key, your balance, full message history and delivery statuses.
          </div>
        </div>
        <div className="card">
          <div className="k">
            <Coins aria-hidden="true" /> Simple pricing
          </div>
          <div className="v" style={{ fontSize: 24 }}>
            {formatPeso(price)}
            <span style={{ fontSize: 14, color: "var(--mut)" }}> / credit</span>
          </div>
          <div className="s">One flat rate per credit. Buy only what you need, use credits for any message type.</div>
        </div>
      </section>

      <section className="sect">
        <h2>What each message costs</h2>
        <p className="secsub">
          Credits are the only currency inside SMS SOFT. Every send is charged per recipient, at the rates below — shown before
          you send, never after.
        </p>
        <div className="tablewrap">
        <table className="mtable">
          <tbody>
            <tr>
              <th>Message type</th>
              <th>Credits</th>
              <th>Cost at {formatPeso(price)}/credit</th>
              <th>Best for</th>
            </tr>
            <tr>
              <td>
                <b>Regular</b>
              </td>
              <td>{cR}</td>
              <td>{formatPeso(price * cR)}</td>
              <td>Announcements, reminders, promos</td>
            </tr>
            <tr>
              <td>
                <b>Priority</b>
              </td>
              <td>{cP}</td>
              <td>{formatPeso(price * cP)}</td>
              <td>Urgent alerts that skip the queue</td>
            </tr>
            <tr>
              <td>
                <b>OTP</b>
              </td>
              <td>{cO}</td>
              <td>{formatPeso(price * cO)}</td>
              <td>Verification codes for logins and sign-ups</td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>

      <section className="sect">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step">
            <div className="n">1</div>
            <h3>Create your account</h3>
            <p>Register with your name and email. Your account, API key, and wallet are created instantly — no approval wait to look around.</p>
          </div>
          <div className="step">
            <div className="n">2</div>
            <h3>Top up credits</h3>
            <p>
              Choose how many credits you need on the Credits page, pay using the payment instructions shown there, and submit
              your payment reference. Credits are added to your balance once your payment is verified.
            </p>
          </div>
          <div className="step">
            <div className="n">3</div>
            <h3>Send your first SMS</h3>
            <p>Type a message in the dashboard, paste numbers or upload a CSV, and send. Track every message and its status in Messages.</p>
          </div>
        </div>
      </section>

      <section className="sect">
        <h2>Everything in your account</h2>
        <div className="cards">
          <div className="card">
            <div className="k">
              <FileSpreadsheet aria-hidden="true" /> Bulk via CSV
            </div>
            <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
              Upload a spreadsheet of numbers and send to a whole list in one go — with personalization per row.
            </div>
          </div>
          <div className="card">
            <div className="k">
              <Users aria-hidden="true" /> Contacts &amp; groups
            </div>
            <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
              Save the numbers you message often and organize them into groups, so regular broadcasts take seconds.
            </div>
          </div>
          <div className="card">
            <div className="k">
              <History aria-hidden="true" /> Message history
            </div>
            <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
              Every send is recorded with its recipient, cost, and delivery status. Your credit ledger shows each top-up and deduction.
            </div>
          </div>
          <div className="card">
            <div className="k">
              <KeyRound aria-hidden="true" /> Your own API key
            </div>
            <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
              Connect your own apps and systems. Send SMS and check your balance programmatically, anytime.
            </div>
          </div>
          <div className="card">
            <div className="k">
              <Wallet aria-hidden="true" /> One wallet for all
            </div>
            <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
              Dashboard sends, bulk uploads, and API calls all draw from the same credit balance. One top-up covers everything.
            </div>
          </div>
          <div className="card">
            <div className="k">
              <Signature aria-hidden="true" /> Sender name pool
            </div>
            <div className="s" style={{ fontSize: 14, marginTop: 8 }}>
              Recipients see a name they can recognize, not a random mobile number — you pick it from the <b>approved pool</b>{" "}
              every time you send, on the web or through the API.
            </div>
          </div>
        </div>
      </section>

      <section className="sect">
        <h2>For developers</h2>
        <p className="secsub">Send an SMS with a single request. Your API key is in your account under API Access.</p>
        <div className="codepanel">
          <div className="cp-head">
            <span className="dot r" />
            <span className="dot y" />
            <span className="dot g" />
            &nbsp; POST /api/send.php
          </div>
          <pre>
            {`$ curl -X POST https://your-smmssoft-domain/api/send.php \\
  -d "apikey=YOUR_API_KEY" \\
  -d "number=09171234567" \\
  -d "message=Your order has been shipped." \\
  -d "kind=regular"

{ "ok": true, "sent": 1, "cost": ${cR}, "balance": 848 }`}
          </pre>
        </div>
        <p className="s" style={{ marginTop: 10 }}>
          Full endpoint reference, parameters, and error codes: <Link href="/api-access">API Access page</Link> after you sign in.
        </p>
      </section>

      <section className="sect">
        <h2>Built for Philippine teams</h2>
        <p className="secsub">
          Barangay and LGU announcements · class suspensions and school notices · order and delivery updates for online sellers ·
          appointment reminders for clinics · promos and restock alerts for retail · dispatch and tracking notices for logistics.
        </p>
      </section>

      <section className="sect">
        <h2>Common questions</h2>
        <div className="faq">
          <h3>What name will recipients see as the sender?</h3>
          <p>
            You pick the sender name for every send from the platform&apos;s approved pool — the default is <b>{sender}</b> — so
            recipients always see a consistent, recognizable name on your announcements, alerts, and codes, never a random number.
          </p>
        </div>
        <div className="faq">
          <h3>How do I get credits?</h3>
          <p>
            Register, open the Credits page, and choose an amount. Pay using the payment instructions shown there
            {payNote !== "" ? ` (currently: ${payNote})` : ""}, then submit your payment reference. Your credits are added once
            the payment is verified.
          </p>
        </div>
        <div className="faq">
          <h3>Which networks can I send to?</h3>
          <p>Globe, Smart, TNT, DITO, and Sun numbers across the Philippines.</p>
        </div>
        <div className="faq">
          <h3>How is a send charged?</h3>
          <p>
            Per recipient, by message type: Regular {cR} credit{cR > 1 ? "s" : ""}, Priority {cP} credits, OTP {cO} credits. The
            composer and the API both show the exact cost and your remaining balance before and after every send.
          </p>
        </div>
        <div className="faq">
          <h3>Do I need to be a developer to use SMS SOFT?</h3>
          <p>No. The dashboard covers sending, bulk uploads, contacts, and history. The API is there only if you want to connect your own system.</p>
        </div>
      </section>

      <section className="ctaband">
        <h2>Ready to send your first message?</h2>
        <p>Create a free account and be sending within minutes.</p>
        <Link className="btn" href="/register">
          <Rocket aria-hidden="true" /> Create account
        </Link>
        <Link className="btn ghost" href="/login">
          Login
        </Link>
      </section>

      <footer className="land-foot">SMS SOFT · SMS services for PH businesses · Globe · Smart · TNT · DITO · Sun supported</footer>
    </div>
  );
}
