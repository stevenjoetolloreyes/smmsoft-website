"use client";

import Link from "next/link";
import { useActionState, useState , useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addContactAction,
  deleteContactAction,
  editContactAction,
  groupSendAction,
} from "@/lib/actions-customer";
import { emptyActionState } from "@/lib/action-state";
import {Layers, Pencil, Plus, Save, Send, SquarePen, Trash2, UserPlus, Users} from "lucide-react";

export type ContactRow = { id: number; name: string; number: string; groupName: string };
export type GroupRow = { name: string; count: number };

function Flash({ message, ok }: { message: string; ok: boolean }) {
  if (message === "") return null;
  return <div className={`flash ${ok ? "ok" : "err"}`}>{message}</div>;
}

export default function ContactForms({
  contacts,
  groups,
  senders,
  defaultSender,
}: {
  contacts: ContactRow[];
  groups: GroupRow[];
  senders: string[];
  defaultSender: string;
}) {
  const [addState, addAction, addPending] = useActionState(addContactAction, emptyActionState);
  const [editState, editAction, editPending] = useActionState(editContactAction, emptyActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteContactAction, emptyActionState);
  const [groupState, groupAction, groupPending] = useActionState(groupSendAction, emptyActionState);
  const router = useRouter();
  useEffect(() => { if (addState.ok || editState.ok || deleteState.ok) router.refresh(); }, [addState, editState, deleteState, router]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [groupSendGroup, setGroupSendGroup] = useState(groups[0]?.name ?? "");
  const [groupKind, setGroupKind] = useState<"regular" | "priority" | "otp">("regular");
  const [groupSender, setGroupSender] = useState(defaultSender);

  const editing = contacts.find((c) => c.id === editingId) ?? null;

  return (
    <>
      <Flash message={addState.message} ok={addState.ok} />
      <Flash message={editState.message} ok={editState.ok} />
      <Flash message={deleteState.message} ok={deleteState.ok} />
      <div className="grid2">
        <div className="panel">
          <h2>
            <UserPlus aria-hidden="true" /> Add Contact
          </h2>
          <form action={addAction}>
            <label>Name</label>
            <input type="text" name="name" required />
            <label>Mobile number</label>
            <input type="text" name="number" placeholder="09xxxxxxxxx" required />
            <label>Group</label>
            <input type="text" name="group_name" placeholder="General" list="grouplist" />
            <datalist id="grouplist">
              {groups.map((g) => (
                <option key={g.name} value={g.name} />
              ))}
            </datalist>
            <div className="mt">
              <button className="btn" type="submit" disabled={addPending}>
                <Plus aria-hidden="true" /> Add
              </button>
            </div>
          </form>
        </div>
        <div className="panel">
          <h2>
            <Layers aria-hidden="true" /> Groups
          </h2>
          {groups.length === 0 && <p className="hint">No groups yet.</p>}
          {groups.map((g) => (
            <div
              key={g.name}
              className="rowflex"
              style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "8px 0" }}
            >
              <span>
                {g.name} <span className="hint">({g.count})</span>
              </span>
              <Link className="btn ghost small" href={`/send?group=${encodeURIComponent(g.name)}`}>
                <Send aria-hidden="true" /> Send to group
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>
          <Send aria-hidden="true" /> Text a Group
        </h2>
        <Flash message={groupState.message} ok={groupState.ok} />
        <form action={groupAction}>
          <label>Group</label>
          <select name="group" value={groupSendGroup} onChange={(e) => setGroupSendGroup(e.target.value)} required>
            {groups.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.count})
              </option>
            ))}
          </select>
          <label>Message type</label>
          <select name="kind" value={groupKind} onChange={(e) => setGroupKind(e.target.value as "regular" | "priority" | "otp")}>
            <option value="regular">Regular</option>
            <option value="priority">Priority</option>
            <option value="otp">OTP</option>
          </select>
          <label>Sender name — pick from the approved pool</label>
          <select name="sender" value={groupSender} onChange={(e) => setGroupSender(e.target.value)}>
            {senders.map((sn) => (
              <option key={sn} value={sn}>
                {sn}
                {sn === defaultSender ? " (default)" : ""}
              </option>
            ))}
          </select>
          <label>Message</label>
          <textarea name="message" rows={4} required />
          <div className="mt">
            <button className="btn" type="submit" disabled={groupPending || groups.length === 0}>
              <Send aria-hidden="true" /> Send to group
            </button>
          </div>
        </form>
      </div>

      {editing && (
        <div className="panel">
          <h2>
            <SquarePen aria-hidden="true" /> Edit Contact
          </h2>
          <form action={editAction}>
            <input type="hidden" name="id" value={editing.id} />
            <label>Name</label>
            <input type="text" name="name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            <label>Mobile number</label>
            <input type="text" name="number" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} required />
            <label>Group</label>
            <input type="text" name="group_name" value={editGroup} onChange={(e) => setEditGroup(e.target.value)} list="grouplist" />
            <div className="mt rowflex">
              <button className="btn" type="submit" disabled={editPending}>
                <Save aria-hidden="true" /> Save
              </button>
              <button className="btn ghost" type="button" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <h2>
          <Users aria-hidden="true" /> All Contacts ({contacts.length})
        </h2>
        <div className="tablewrap">
          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <th>Number</th>
                <th>Group</th>
                <th></th>
              </tr>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.number}</td>
                  <td>{c.groupName}</td>
                  <td className="rowflex">
                    <Link className="btn ghost small" href={`/send?to=${encodeURIComponent(c.number)}`}>
                      <Send aria-hidden="true" /> Text
                    </Link>
                    <button
                      className="btn ghost small"
                      type="button"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                        setEditNumber(c.number);
                        setEditGroup(c.groupName);
                      }}
                    >
                      <Pencil aria-hidden="true" /> Edit
                    </button>
                    <form
                      action={deleteAction}
                      onSubmit={(e) => {
                        if (!window.confirm("Delete this contact?")) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn danger small" type="submit" disabled={deletePending} aria-label="Delete contact">
                        <Trash2 aria-hidden="true" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
