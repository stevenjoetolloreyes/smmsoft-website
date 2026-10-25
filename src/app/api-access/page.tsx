import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ApiKeyPanel from "@/components/customer/ApiKeyPanel";
import { findUserById, getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/sms";

export default async function ApiAccessPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await findUserById(session.id);
  if (!user) redirect("/login");
  const h = await headers();
  const host = h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}`;
  return (
    <AppShell title="API Access" active="api" user={session}>
      <ApiKeyPanel apiKey={user.apiKey} createdAt={formatDateTime(user.createdAt)} baseUrl={baseUrl} />
    </AppShell>
  );
}
