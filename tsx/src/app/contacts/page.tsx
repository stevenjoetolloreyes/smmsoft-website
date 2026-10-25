import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ContactForms from "@/components/customer/ContactForms";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { smsContacts } from "@/lib/schema";
import { sendersPool, senderDefault } from "@/lib/server/send";

export default async function ContactsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const db = await getDb();
  const contacts = await db
    .select()
    .from(smsContacts)
    .where(eq(smsContacts.userId, session.id))
    .orderBy(asc(smsContacts.groupName), asc(smsContacts.name));
  const groupRows = await db
    .select({ groupName: smsContacts.groupName, c: count() })
    .from(smsContacts)
    .where(eq(smsContacts.userId, session.id))
    .groupBy(smsContacts.groupName)
    .orderBy(asc(smsContacts.groupName));
  const pool = await sendersPool();
  const def = await senderDefault();
  return (
    <AppShell title="Contacts" active="contacts" user={session}>
      <ContactForms
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, number: c.number, groupName: c.groupName }))}
        groups={groupRows.map((g) => ({ name: g.groupName, count: g.c }))}
        senders={pool}
        defaultSender={def}
      />
    </AppShell>
  );
}
