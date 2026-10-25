"use client";

import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

const KEY = "smms-collapsed";

/**
 * Desktop sidebar collapse toggle (240px <-> 72px). Purely presentational:
 * it only toggles a class on <body> and remembers the choice in
 * localStorage. On tablet/mobile widths the sidebar is a drawer instead,
 * and the collapsed class is ignored by CSS there.
 */
export default function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") {
        document.body.classList.add("collapsed");
        setCollapsed(true);
      }
    } catch {
      // Private mode etc. — expanded sidebar is the safe default.
    }
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.body.classList.toggle("collapsed", next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Ignore storage failures; the toggle still works for this page.
    }
  };

  return (
    <button
      type="button"
      className="collapse-btn"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={toggle}
    >
      {collapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
    </button>
  );
}
