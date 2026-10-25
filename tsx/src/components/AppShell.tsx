import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import { userCredits } from "@/lib/sms";
import { NavClose, NavToggle } from "./NavToggle";

export type NavKey =
  | "dashboard"
  | "send"
  | "bulk"
  | "messages"
  | "contacts"
  | "credits"
  | "api"
  | "settings"
  | "admin";

const NAV: { section: string; href: string; key: NavKey; icon: string; label: string }[] = [
  { section: "Messaging", href: "/dashboard", key: "dashboard", icon: "fa-gauge-high", label: "Dashboard" },
  { section: "Messaging", href: "/send", key: "send", icon: "fa-paper-plane", label: "Send SMS" },
  { section: "Messaging", href: "/bulk", key: "bulk", icon: "fa-file-csv", label: "Bulk via CSV" },
  { section: "Messaging", href: "/messages", key: "messages", icon: "fa-envelope-open-text", label: "Messages" },
  { section: "Messaging", href: "/contacts", key: "contacts", icon: "fa-address-book", label: "Contacts" },
  { section: "Account", href: "/credits", key: "credits", icon: "fa-wallet", label: "Credits" },
  { section: "Account", href: "/api-access", key: "api", icon: "fa-code", label: "API Access" },
  { section: "Account", href: "/settings", key: "settings", icon: "fa-gear", label: "Settings" },
  { section: "Platform", href: "/admin", key: "admin", icon: "fa-user-shield", label: "Admin Panel" },
];

/**
 * App shell — faithful port of PHP lib/layout.php layout_head/layout_foot.
 * Pages render <AppShell title active user>…children…</AppShell> and must
 * already have redirected unauthenticated visitors to /login (or /admin
 * pages to /login when not admin).
 */
export default async function AppShell({
  title,
  active,
  user,
  children,
}: {
  title: string;
  active: NavKey;
  user: SessionUser;
  children: ReactNode;
}) {
  const credits = await userCredits(user.id);
  const sections = ["Messaging", "Account", ...(user.isAdmin ? ["Platform"] : [])];

  return (
    <div className="shell">
      <aside className="sidebar" id="sidebar">
        <div className="brand">
          <i className="fa-solid fa-tower-broadcast" /> SMMSOFT
        </div>
        <NavClose />
        <nav>
          {sections.map((section) => (
            <span key={section}>
              <div className="nav-label">{section}</div>
              {NAV.filter((n) => n.section === section).map((n) => (
                <Link key={n.key} href={n.href} className={active === n.key ? "on" : ""}>
                  <i className={`fa-solid ${n.icon}`} /> {n.label}
                </Link>
              ))}
            </span>
          ))}
        </nav>
        <div className="side-user">
          <div className="su-name">{user.name}</div>
          <div className="su-mail">{user.email}</div>
          <Link className="su-out" href="/logout" prefetch={false}>
            <i className="fa-solid fa-right-from-bracket" /> Logout
          </Link>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <NavToggle />
          <h1>{title}</h1>
          <div className="top-right">
            <Link className="bal-pill" href="/credits">
              <i className="fa-solid fa-coins" /> Credits&nbsp;<b>{credits.toLocaleString("en-PH")}</b>
            </Link>
            <span className="user-chip">
              <i className="fa-solid fa-circle-user" /> {user.name}
            </span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

/** Status pill — mirrors PHP status_pill(). */
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Sent: "ok",
    Queued: "warn",
    Pending: "warn",
    Failed: "bad",
    Refunded: "mute",
    pending: "warn",
    approved: "ok",
    rejected: "bad",
    active: "ok",
    suspended: "bad",
  };
  const cls = map[status] ?? "mute";
  return <span className={`pill ${cls}`}>{status}</span>;
}
