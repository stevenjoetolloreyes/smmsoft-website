"use client";

import { useActionState, useState } from "react";
import { bulkAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";
import {Upload} from "lucide-react";

export default function BulkForm({
  senders,
  defaultSender,
}: {
  senders: string[];
  defaultSender: string;
}) {
  const [state, action, isPending] = useActionState(bulkAction, emptyActionState);
  const [sender, setSender] = useState(defaultSender);
  const [defaultMessage, setDefaultMessage] = useState("");
  return (
    <form action={action} encType="multipart/form-data">
      {state.message !== "" && (
        <div className={`flash ${state.ok ? "ok" : "err"}`}>{state.message}</div>
      )}
      <label>CSV file (columns: name, number, message)</label>
      <input type="file" name="csv" accept=".csv,text/csv" required />
      <label>Default message (used for rows with an empty message; {"{name}"} is replaced per row)</label>
      <textarea
        name="default_message"
        rows={3}
        placeholder="Hello {name}, your order is ready for pickup."
        value={defaultMessage}
        onChange={(e) => setDefaultMessage(e.target.value)}
      />
      <label>Sender name — pick from the approved pool</label>
      <select name="sender" value={sender} onChange={(e) => setSender(e.target.value)}>
        {senders.map((sn) => (
          <option key={sn} value={sn}>
            {sn}
            {sn === defaultSender ? " (default)" : ""}
          </option>
        ))}
      </select>
      <div className="mt">
        <button className="btn" type="submit" disabled={isPending}>
          <Upload aria-hidden="true" /> {isPending ? "Sending…" : "Upload & Send"}
        </button>
      </div>
      <p className="hint">Each row costs credits like a regular send. Sending stops automatically if your balance runs out.</p>
    </form>
  );
}
