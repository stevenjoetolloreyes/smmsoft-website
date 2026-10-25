'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  addSender,
  adjustCredits,
  decideTopup,
  deleteSender,
  savePlatformSettings,
  setDefaultSender,
  setUserStatus,
  type AdminActionResult,
} from '@/lib/actions-admin';

function Flash({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return <div className={`flash ${result.ok ? 'ok' : 'err'}`}>{result.message}</div>;
}

/** Per-row credit adjustment: amount (+100 / -50) plus an optional note. */
export function AdjustForm({ userId }: { userId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);
  return (
    <div>
      <form
        className="rowflex"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const delta = parseInt(String(data.get('amount') ?? ''), 10);
          const note = String(data.get('note') ?? '');
          if (!Number.isFinite(delta) || delta === 0) {
            setResult({ ok: false, message: 'Enter a non-zero amount.' });
            return;
          }
          start(async () => {
            const r = await adjustCredits(userId, delta, note);
            setResult(r);
            if (r.ok) router.refresh();
          });
        }}
      >
        <input type="text" name="amount" placeholder="+100 / -50" style={{ width: '100px' }} />
        <input type="text" name="note" placeholder="Note (optional)" style={{ width: '140px' }} />
        <button className="btn small" type="submit" disabled={pending}>
          Apply
        </button>
      </form>
      <Flash result={result} />
    </div>
  );
}

/** Suspend / Activate toggle for one non-admin user. */
export function StatusButton({
  userId,
  status,
}: {
  userId: number;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const next = status === 'active' ? 'suspended' : 'active';
  return (
    <div>
      <button
        className={`btn ${status === 'active' ? 'danger' : 'ghost'} small`}
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setUserStatus(userId, next);
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
      >
        {status === 'active' ? 'Suspend' : 'Activate'}
      </button>
      <Flash result={result} />
    </div>
  );
}

/** Approve / Reject buttons for one pending top-up. */
export function TopupDecideButtons({ topupId }: { topupId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);
  return (
    <div>
      <div className="rowflex">
        <button
          className="btn small"
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await decideTopup(topupId, 'approve');
              setResult(r);
              if (r.ok) router.refresh();
            })
          }
        >
          Approve
        </button>
        <button
          className="btn danger small"
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await decideTopup(topupId, 'reject');
              setResult(r);
              if (r.ok) router.refresh();
            })
          }
        >
          Reject
        </button>
      </div>
      <Flash result={result} />
    </div>
  );
}

/** Add a sender name to the pool. */
export function SenderAddForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);
  return (
    <div>
      <form
        className="rowflex mt"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const name = String(data.get('name') ?? '');
          start(async () => {
            const r = await addSender(name);
            setResult(r);
            if (r.ok) {
              form.reset();
              router.refresh();
            }
          });
        }}
      >
        <input
          type="text"
          name="name"
          maxLength={11}
          placeholder="New sender name (max 11)"
          style={{ maxWidth: '260px' }}
          required
        />
        <button className="btn small" type="submit" disabled={pending}>
          <i className="fa-solid fa-plus" /> Add to pool
        </button>
      </form>
      <Flash result={result} />
    </div>
  );
}

/** Set-default and Remove buttons for one sender pool row. */
export function SenderRowButtons({
  senderId,
  senderName,
  isDefault,
}: {
  senderId: number;
  senderName: string;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);
  return (
    <div>
      <div className="rowflex">
        {!isDefault && (
          <button
            className="btn ghost small"
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setDefaultSender(senderId);
                setResult(r);
                if (r.ok) router.refresh();
              })
            }
          >
            Set default
          </button>
        )}
        <button
          className="btn danger small"
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Remove ${senderName} from the pool?`)) return;
            start(async () => {
              const r = await deleteSender(senderId);
              setResult(r);
              if (r.ok) router.refresh();
            });
          }}
        >
          Remove
        </button>
      </div>
      <Flash result={result} />
    </div>
  );
}

export type PlatformSettingsValues = {
  defaultSender: string;
  pricePerCredit: string;
  costRegular: string;
  costPriority: string;
  costOtp: string;
  welcomeCredits: string;
  paymentInstructions: string;
  upstreamConfigured: boolean;
};

/**
 * Platform settings form. The upstream key input is ALWAYS rendered empty
 * (placeholder: leave blank to keep current key) — the stored key is never
 * prefilled, echoed, or masked from its value.
 */
export function PlatformSettingsForm({ initial }: { initial: PlatformSettingsValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const r = await savePlatformSettings(data);
          setResult(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <label>Upstream (Semaphore) API key — leave blank to keep current key</label>
      <input
        type="text"
        name="upstream_api_key"
        defaultValue=""
        placeholder="Leave blank to keep current key"
        autoComplete="off"
      />
      <p className="hint">
        Currently: {initial.upstreamConfigured ? 'configured' : 'NOT SET'}. If the
        SEMAPHORE_API_KEY environment variable is set, it takes precedence over the saved
        setting. Your customers never see this key.
      </p>
      <label>Fallback sender name (approved on the upstream account, max 11 chars)</label>
      <input
        type="text"
        name="default_sender"
        defaultValue={initial.defaultSender}
        maxLength={11}
      />
      <p className="hint">
        Customers pick from the pool in the <b>Sender Names</b> tab — the pool&apos;s default
        is set there. This fallback is only used if the pool is ever empty.
      </p>
      <div className="grid2">
        <div>
          <label>Price per credit (₱) — what customers pay</label>
          <input type="text" name="price_per_credit" defaultValue={initial.pricePerCredit} />
        </div>
        <div>
          <label>Welcome credits for new accounts</label>
          <input type="text" name="welcome_credits" defaultValue={initial.welcomeCredits} />
        </div>
        <div>
          <label>Cost: regular (credits per part)</label>
          <input type="text" name="cost_regular" defaultValue={initial.costRegular} />
        </div>
        <div>
          <label>Cost: priority (credits per part)</label>
          <input type="text" name="cost_priority" defaultValue={initial.costPriority} />
        </div>
        <div>
          <label>Cost: OTP (credits per part)</label>
          <input type="text" name="cost_otp" defaultValue={initial.costOtp} />
        </div>
      </div>
      <label>Payment instructions shown to customers on the Buy Credits page</label>
      <textarea
        name="payment_instructions"
        rows={3}
        defaultValue={initial.paymentInstructions}
      />
      <div className="mt">
        <button className="btn" type="submit" disabled={pending}>
          <i className="fa-solid fa-floppy-disk" /> Save settings
        </button>
      </div>
      <Flash result={result} />
    </form>
  );
}
