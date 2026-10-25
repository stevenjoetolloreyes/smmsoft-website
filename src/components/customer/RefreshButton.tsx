"use client";

import { useActionState , useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshMessagesAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";
import {RotateCw} from "lucide-react";

export default function RefreshButton() {
  const [state, action, isPending] = useActionState(refreshMessagesAction, emptyActionState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  return (
    <>
      <form action={action}>
        <button className="btn ghost small" type="submit" disabled={isPending}>
          <RotateCw aria-hidden="true" /> {isPending ? "Refreshing…" : "Refresh statuses"}
        </button>
      </form>
      {state.message !== "" && (
        <div className={`flash ${state.ok ? "ok" : "info"}`} style={{ marginTop: 14 }}>
          {state.message}
        </div>
      )}
    </>
  );
}
