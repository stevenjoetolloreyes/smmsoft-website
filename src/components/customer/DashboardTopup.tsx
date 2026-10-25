"use client";

import Link from "next/link";
import { useState } from "react";

function formatPeso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Dashboard top-up calculator — mirrors the PHP dashboard inline script. */
export default function DashboardTopup({ price, balance }: { price: number; balance: number }) {
  const [raw, setRaw] = useState("500");
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10) || 0;
  return (
    <>
      <label>Credits amount</label>
      <input type="text" inputMode="numeric" placeholder="500" value={raw} onChange={(e) => setRaw(e.target.value)} />
      <ul className="breakdown">
        <li>
          <span>Credits</span>
          <b>{n.toLocaleString("en-PH")}</b>
        </li>
        <li>
          <span>Price per credit</span>
          <b>{formatPeso(price)}</b>
        </li>
        <li>
          <span>Total to pay</span>
          <b>{formatPeso(n * price)}</b>
        </li>
        <li>
          <span>Balance after approval</span>
          <b>{(balance + n).toLocaleString("en-PH")}</b>
        </li>
      </ul>
      <div className="mt">
        <Link className="btn" href={`/credits?credits=${n}`}>
          <i className="fa-solid fa-wallet" /> Continue to top up
        </Link>
      </div>
    </>
  );
}
