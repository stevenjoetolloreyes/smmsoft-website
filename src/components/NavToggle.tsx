"use client";

import { useState } from "react";
import {Menu, X} from "lucide-react";

/**
 * Mobile sidebar drawer toggle (PHP assets/app.js behavior):
 * the hamburger opens the sidebar + backdrop; the X or the backdrop closes it.
 */
export function NavToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Menu"
        onClick={() => {
          setOpen(true);
          document.getElementById("sidebar")?.classList.add("open");
          document.getElementById("backdrop")?.classList.add("on");
        }}
      >
        <Menu aria-hidden="true" />
      </button>
      {open && (
        <div
          id="backdrop"
          className="backdrop on"
          onClick={() => {
            setOpen(false);
            document.getElementById("sidebar")?.classList.remove("open");
            document.getElementById("backdrop")?.classList.remove("on");
          }}
        />
      )}
    </>
  );
}

export function NavClose() {
  return (
    <button
      type="button"
      className="side-close"
      aria-label="Close menu"
      onClick={() => {
        document.getElementById("sidebar")?.classList.remove("open");
        document.getElementById("backdrop")?.classList.remove("on");
      }}
    >
      <X aria-hidden="true" />
    </button>
  );
}
