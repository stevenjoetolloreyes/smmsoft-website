import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import BulkForm from "@/components/customer/BulkForm";
import { getSession } from "@/lib/auth";
import { sendersPool, senderDefault } from "@/lib/server/send";
import {Download, FileSpreadsheet} from "lucide-react";

export default async function BulkPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const pool = await sendersPool();
  const def = await senderDefault();
  return (
    <AppShell title="Bulk via CSV" active="bulk" user={session}>
      <div className="tabs">
        <Link href="/send">Single message</Link>
        <Link href="/bulk" className="on">
          Bulk via CSV
        </Link>
      </div>
      <div className="panel">
        <h2>
          <FileSpreadsheet aria-hidden="true" /> Personalized bulk sending
        </h2>
        <p className="hint">
          Upload a CSV where every row has its own message — best for names, amounts, or codes that differ per person. For ONE
          message to many people, use <Link href="/send">Send SMS</Link> instead.
        </p>
        <p className="mt">
          <Link className="btn ghost small" href="/bulk/template">
            <Download aria-hidden="true" /> Download CSV template
          </Link>
        </p>
        <BulkForm senders={pool} defaultSender={def} />
      </div>
    </AppShell>
  );
}
