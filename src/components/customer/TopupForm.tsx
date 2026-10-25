"use client";

import { useActionState, useState , useEffect } from "react";
import { useRouter } from "next/navigation";
import { topupAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";
import {Send} from "lucide-react";

function formatPeso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TopupForm({
  price,
  balance,
  initialCredits,
}: {
  price: number;
  balance: number;
  initialCredits: string;
}) {
  const [state, action, isPending] = useActionState(topupAction, emptyActionState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  const [creditsRaw, setCreditsRaw] = useState(initialCredits);
  const n = parseInt(creditsRaw.replace(/[^\d]/g, ""), 10) || 0;
  return (
    <form action={action}>
      {state.message !== "" && (
        <div className={`flash ${state.ok ? "ok" : "err"}`}>{state.message}</div>
      )}
      <label>Credits wanted</label>
      <input
        type="text"
        name="credits"
        inputMode="numeric"
        placeholder="100"
        value={creditsRaw}
        onChange={(e) => setCreditsRaw(e.target.value)}
      />
      <ul className="breakdown">
        <li>
          <span>Credits</span>
          <b>{n.toLocaleString("en-PH")}</b>
        </li>
        <li>
          <span>Price per credit</span>
          <b>{formatPeso(price)}</b>
        </li>
        <li>
          <span>Total to pay</span>
          <b>{formatPeso(n * price)}</b>
        </li>
        <li>
          <span>Balance after approval</span>
          <b>{(balance + n).toLocaleString("en-PH")}</b>
        </li>
      </ul>
      <label>Payment reference number</label>
      <input type="text" name="pay_ref" placeholder="e.g. GCash ref no." />
      <div className="mt">
        <button className="btn" type="submit" disabled={isPending}>
          <Send aria-hidden="true" /> {isPending ? "Submitting…" : "Submit top-up request"}
        </button>
      </div>
    </form>
  );
}
