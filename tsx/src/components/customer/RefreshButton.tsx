"use client";

import { useActionState , useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshMessagesAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";

export default function RefreshButton() {
  const [state, action, isPending] = useActionState(refreshMessagesAction, emptyActionState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);
  return (
    <>
      <form action={action}>
        <button className="btn ghost small" type="submit" disabled={isPending}>
          <i className="fa-solid fa-rotate" /> {isPending ? "Refreshing…" : "Refresh statuses"}
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
