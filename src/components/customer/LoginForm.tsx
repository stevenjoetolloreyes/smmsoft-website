"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";
import {LogIn} from "lucide-react";

export default function LoginForm() {
  const [state, action, isPending] = useActionState(loginAction, emptyActionState);
  return (
    <form action={action}>
      {state.message !== "" && (
        <div className={`flash ${state.ok ? "ok" : "err"}`}>{state.message}</div>
      )}
      <label>Email</label>
      <input type="email" name="email" required autoFocus />
      <label>Password</label>
      <input type="password" name="password" required />
      <div className="mt">
        <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }} disabled={isPending}>
          <LogIn aria-hidden="true" /> {isPending ? "Logging in…" : "Login"}
        </button>
      </div>
      <p className="hint">
        No account yet? <Link href="/register">Create one</Link>
      </p>
    </form>
  );
}
