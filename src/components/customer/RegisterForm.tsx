"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";
import {UserPlus} from "lucide-react";

export default function RegisterForm() {
  const [state, action, isPending] = useActionState(registerAction, emptyActionState);
  return (
    <form action={action}>
      {state.message !== "" && (
        <div className={`flash ${state.ok ? "ok" : "err"}`}>{state.message}</div>
      )}
      <label>Full name / Business name</label>
      <input type="text" name="name" required />
      <label>Email</label>
      <input type="email" name="email" required />
      <label>Password (min 6 characters)</label>
      <input type="password" name="password" required />
      <label>Confirm password</label>
      <input type="password" name="confirm" required />
      <div className="mt">
        <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }} disabled={isPending}>
          <UserPlus aria-hidden="true" /> {isPending ? "Creating account…" : "Create account"}
        </button>
      </div>
      <p className="hint">
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}
