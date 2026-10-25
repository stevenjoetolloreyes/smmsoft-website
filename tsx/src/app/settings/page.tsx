import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import SettingsForms from "@/components/customer/SettingsForms";
import { findUserById, getSession } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await findUserById(session.id);
  if (!user) redirect("/login");
  return (
    <AppShell title="Settings" active="settings" user={session}>
      <SettingsForms name={user.name} email={user.email} />
    </AppShell>
  );
}
