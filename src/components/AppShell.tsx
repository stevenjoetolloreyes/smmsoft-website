import Link from "next/link";
import type { ReactNode } from "react";
import {
  CircleUser,
  Coins,
  FileSpreadsheet,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  RadioTower,
  Send,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { userCredits } from "@/lib/sms";
import { NavClose, NavToggle } from "./NavToggle";
import SidebarToggle from "./SidebarToggle";

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

/**
 * Nav groups follow the redesign prompt, adapted to the routes this app
 * actually has. No page is invented: Messages covers message history,
 * Credits covers top-ups + credit history, Settings covers profile, and
 * the Admin Panel stays admin-only. Every href below is a real route.
 */
const NAV: { section: string; href: string; key: NavKey; icon: LucideIcon; label: string }[] = [
  { section: "Overview", href: "/dashboard", key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { section: "Messaging", href: "/send", key: "send", icon: Send, label: "Send SMS" },
  { section: "Messaging", href: "/bulk", key: "bulk", icon: FileSpreadsheet, label: "Bulk via CSV" },
  { section: "Messaging", href: "/messages", key: "messages", icon: MessageSquare, label: "Messages" },
  { section: "Contacts", href: "/contacts", key: "contacts", icon: Users, label: "Contacts" },
  { section: "Developer", href: "/api-access", key: "api", icon: KeyRound, label: "API Access" },
  { section: "Credits & Billing", href: "/credits", key: "credits", icon: Wallet, label: "Credits" },
  { section: "Account", href: "/settings", key: "settings", icon: Settings, label: "Settings" },
  { section: "Platform", href: "/admin", key: "admin", icon: ShieldCheck, label: "Admin Panel" },
];

/**
 * App shell — same contract as before: pages render
 * <AppShell title active user>…children…</AppShell> and must already have
 * redirected unauthenticated visitors to /login (or /admin pages to
 * /login when not admin). Only the presentation changed.
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
  const sections = [
    "Overview",
    "Messaging",
    "Contacts",
    "Developer",
    "Credits & Billing",
    "Account",
    ...(user.isAdmin ? ["Platform"] : []),
  ];

  return (
    <div className="shell">
      <aside className="sidebar" id="sidebar">
        <div className="brand-row">
          <div className="brand">
            <RadioTower aria-hidden="true" /> SMS SOFT
          </div>
          <SidebarToggle />
        </div>
        <NavClose />
        <nav aria-label="Main navigation">
          {sections.map((section) => (
            <span key={section}>
              <div className="nav-label">{section}</div>
              {NAV.filter((n) => n.section === section).map((n) => (
                <Link
                  key={n.key}
                  href={n.href}
                  title={n.label}
                  aria-current={active === n.key ? "page" : undefined}
                  className={active === n.key ? "on" : ""}
                >
                  <n.icon aria-hidden="true" /> {n.label}
                </Link>
              ))}
            </span>
          ))}
        </nav>
        <div className="side-user">
          <div className="su-name">{user.name}</div>
          <div className="su-mail">{user.email}</div>
          <Link className="su-out" href="/logout" prefetch={false} title="Logout">
            <LogOut aria-hidden="true" /> Logout
          </Link>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <NavToggle />
          <h1>{title}</h1>
          <div className="top-right">
            <Link className="bal-pill" href="/credits">
              <Coins aria-hidden="true" /> Credits&nbsp;<b>{credits.toLocaleString("en-PH")}</b>
            </Link>
            <span className="user-chip">
              <CircleUser aria-hidden="true" /> {user.name}
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
