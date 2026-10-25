"use client";

import { useActionState , useEffect } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, updateNameAction } from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";
import {Lock, Save, User} from "lucide-react";

export default function SettingsForms({ name, email }: { name: string; email: string }) {
  const [nameState, nameAction, namePending] = useActionState(updateNameAction, emptyActionState);
  const [pwState, pwAction, pwPending] = useActionState(changePasswordAction, emptyActionState);
  const router = useRouter();
  useEffect(() => { if (nameState.ok) router.refresh(); }, [nameState, router]);
  return (
    <>
      <div className="panel">
        <h2>
          <User aria-hidden="true" /> Profile
        </h2>
        {nameState.message !== "" && (
          <div className={`flash ${nameState.ok ? "ok" : "err"}`}>{nameState.message}</div>
        )}
        <form action={nameAction}>
          <label>Name / Business name</label>
          <input type="text" name="name" defaultValue={name} required />
          <label>Email (login)</label>
          <input type="text" value={email} disabled />
          <div className="mt">
            <button className="btn" type="submit" disabled={namePending}>
              <Save aria-hidden="true" /> Save
            </button>
          </div>
        </form>
      </div>
      <div className="panel">
        <h2>
          <Lock aria-hidden="true" /> Change Password
        </h2>
        {pwState.message !== "" && (
          <div className={`flash ${pwState.ok ? "ok" : "err"}`}>{pwState.message}</div>
        )}
        <form action={pwAction}>
          <label>Current password</label>
          <input type="password" name="current" required />
          <label>New password (min 6 characters)</label>
          <input type="password" name="new" required />
          <label>Repeat new password</label>
          <input type="password" name="new2" required />
          <div className="mt">
            <button className="btn" type="submit" disabled={pwPending}>
              <Save aria-hidden="true" /> Change password
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
