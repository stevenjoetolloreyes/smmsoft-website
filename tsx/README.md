# Smmsoft — TSX / Next.js port

Faithful port of the Smmsoft PHP SMS provider platform to Next.js 15
(App Router + TypeScript + Tailwind + Drizzle + libSQL/Turso).
Same features and rules as the PHP version: customers register, buy
credits (manual admin approval only — no fake auto-payment), send via
web or API key; sending runs through Semaphore upstream, server-side only.

## Run locally

```bash
npm install
npm run dev
```

Local dev uses a `local.db` file (auto-created). Do NOT ship `local.db`
to production.

## Deploy on Vercel

1. Create a Turso database (or any libSQL-compatible DB).
2. Set these env vars in Vercel (Production):
   - `TURSO_DATABASE_URL` — e.g. `libsql://your-db.turso.io`
   - `TURSO_AUTH_TOKEN`
   - `SESSION_SECRET` — any long random string
   - `SEMAPHORE_API_KEY` — your Semaphore API key (server-side only,
     never put it in client code or chat)
3. Deploy. First admin account: register `admin@smmsoft.local`, then
   flip that user to admin in the database (or seed it before deploy).

Default pricing: ₱0.65 per credit; Regular 1 / Priority 2 / OTP 2
credits per part. Sender pool rules: sending with a sender name that
is not in the approved pool returns 422 and deducts nothing; messages
starting with TEST are blocked.

## Verified

26/26 end-to-end flows passed locally against a mock upstream
(`MOCK_UPSTREAM=1`, test-only — never set it in production):
register → top-up → admin approve → web send → bulk CSV → customer
API send/account → 402/401/422 cases → admin adjust/suspend/reactivate.

## Known Next.js gotcha (fixed in this code)

Never link to a GET route that mutates state (like `/logout`):
Next.js prefetches links, so the prefetch alone would execute the
logout and silently delete the session cookie. The logout link in
`src/components/AppShell.tsx` carries `prefetch={false}` — do not
remove it.
