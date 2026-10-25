"use client";

import { useActionState, useState } from "react";
import { sendAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";

/** Client mirror of ph_normalize: strip non-digits except +, +63/63 -> 0 prefix. */
function normalizeClient(raw: string): string | null {
  let n = raw.replace(/[^0-9+]/g, "");
  if (n.startsWith("+63")) n = "0" + n.slice(3);
  else if (n.startsWith("63") && n.length === 12) n = "0" + n.slice(2);
  return /^09\d{9}$/.test(n) ? n : null;
}

function countValidRecipients(text: string): number {
  const seen = new Set<string>();
  for (const part of text.split(/[\n,]+/)) {
    const piece = part.trim();
    if (piece === "") continue;
    const n = normalizeClient(piece);
    if (n) seen.add(n);
  }
  return seen.size;
}

export default function SendForm({
  senders,
  defaultSender,
  costs,
  balance,
  prefill,
}: {
  senders: string[];
  defaultSender: string;
  costs: { regular: number; priority: number; otp: number };
  balance: number;
  prefill: string;
}) {
  const [state, action, isPending] = useActionState(sendAction, emptyActionState);
  const [recipients, setRecipients] = useState(prefill);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"regular" | "priority" | "otp">("regular");
  const [otpCode, setOtpCode] = useState("");
  const [sender, setSender] = useState(defaultSender);

  // Live counter mirroring assets/app.js: chars = JS string length;
  // parts = 1 up to 160 chars, then 153 per part; credits = parts x
  // valid recipients x per-kind cost (0 parts / 0 credits when empty).
  const chars = message.length;
  const parts = chars === 0 ? 0 : chars <= 160 ? 1 : Math.ceil(chars / 153);
  const validCount = countValidRecipients(recipients);
  const perKind = costs[kind];
  const credits = parts * validCount * perKind;

  return (
    <form action={action}>
      {state.message !== "" && (
        <div className={`flash ${state.ok ? "ok" : "err"}`}>{state.message}</div>
      )}
      <label>Sender name — pick from the approved pool</label>
      <select name="sender" value={sender} onChange={(e) => setSender(e.target.value)}>
        {senders.map((sn) => (
          <option key={sn} value={sn}>
            {sn}
            {sn === defaultSender ? " (default)" : ""}
          </option>
        ))}
      </select>
      <p className="hint">Recipients see this name as the sender — never a random number.</p>
      <label>Recipients — one per line, or separated by commas (PH numbers, 09xxxxxxxxx)</label>
      <textarea
        id="recipients"
        name="recipients"
        rows={4}
        placeholder={"09171234567\n09981234567"}
        value={recipients}
        onChange={(e) => setRecipients(e.target.value)}
      />
      <label>Message type</label>
      <select
        id="kindSel"
        name="kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as "regular" | "priority" | "otp")}
      >
        <option value="regular">Regular — {costs.regular} credit per SMS part</option>
        <option value="priority">Priority — {costs.priority} credits, skips the queue</option>
        <option value="otp">OTP — {costs.otp} credits, dedicated OTP route (use {"{otp}"} in the message)</option>
      </select>
      {kind === "otp" && (
        <div>
          <label>Your own OTP code (optional — leave blank and one is generated for you; the code replaces {"{otp}"} in the message)</label>
          <input type="text" name="otp_code" maxLength={10} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
        </div>
      )}
      <label>Message</label>
      <textarea
        id="msgBox"
        name="message"
        rows={5}
        placeholder="Type your message here"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="counters">
        <span>
          CHARACTERS <b id="charCount">{chars} / 670</b>
        </span>
        <span>
          CREDITS NEEDED <b id="credCount">{credits}</b>
        </span>
        <span className="count" id="msgCount" style={{ margin: 0 }}>
          {chars} characters · {parts} SMS part(s)
          {validCount > 0 ? ` · ${validCount} recipient(s)` : ""}
          {parts > 0 && validCount > 0 ? ` · approx. ${credits} credit(s)` : ""}
        </span>
      </div>
      <div className="mt">
        <button className="btn" type="submit" disabled={isPending}>
          <i className="fa-solid fa-paper-plane" /> {isPending ? "Sending…" : "Send message"}
        </button>
      </div>
      <p className="hint">
        Your balance: <b>{balance.toLocaleString("en-PH")} credits</b>. Credits are charged only for messages the network accepts.
      </p>
    </form>
  );
}
