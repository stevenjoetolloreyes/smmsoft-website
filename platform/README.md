# SMMSOFT — Your Own SMS Provider Platform

SMMSOFT is a complete, multi-user SMS provider platform. Your customers sign up,
buy credits from you, and send SMS from the web dashboard or through their own
API key. Under the hood, SMMSOFT sends through **your Semaphore account**
(wholesale) — your customers only ever see the **SMMSOFT** brand and sender name.

You keep the margin: you set the price per credit and the credit cost of every
message type.

---

## How the money works

- You buy Semaphore credits wholesale (about ₱0.56 per SMS part).
- You sell **SMMSOFT credits** at your price (default ₱0.65 per credit in
  Admin > Platform Settings).
- Sending costs your customer credits: Regular = 1 credit/part,
  Priority = 2, OTP = 2 (all changeable in the admin).
- Customers request a top-up on their Credits page (they pay you via GCash or
  your preferred channel and submit the reference number). You approve it in
  Admin > Top-ups and the credits land instantly. No fake auto-payments —
  every top-up is verified by you.

## Install (about 5 minutes)

1. Upload the files to your hosting (e.g. `sms.yourdomain.com` subdomain).
2. In **phpMyAdmin**, import **`database.sql`** (creates the `smmsoft`
   database and the admin account).
3. Edit **`config.php`** with your database credentials.
4. Log in as admin: **admin@smmsoft.local / admin123** — change this password
   immediately (Settings).
5. Go to **Admin > Platform Settings**:
   - Paste your **Semaphore API key** (or set `UPSTREAM_API_KEY` in config.php).
   - Set the **sender name** — must be APPROVED on your Semaphore account
     (max 11 characters; `SMMSOFT` fits).
   - Set your **price per credit** and **payment instructions** (your GCash
     number goes here — this is what customers see when buying credits).
6. Optional: give new accounts welcome credits (Platform Settings) so people
   can test right after signing up.

## What customers get

- **Dashboard** — credit balance, message stats, recent activity.
- **Send SMS** — web sender with live character/part/credit counter;
  Regular / Priority / OTP modes; sender name is your platform sender.
- **Bulk via CSV** — personalized message per row.
- **Messages** — their history with live delivery statuses and a refresh button.
- **Contacts** — address book with groups; one tap to text a group.
- **Credits** — balance, price list, top-up requests, full credit ledger.
- **API Access** — their own API key:
  - `POST /api/send.php` — fields: `apikey`, `number`, `message`,
    `kind` (`regular|priority|otp`), `otp_code` (optional).
    Returns `{"ok":true,"sent":N,"cost":C,"balance":B,"message_ids":[...]}`.
  - `GET /api/account.php?apikey=KEY` — name, status, credit balance.

## What you (admin) get

- **Overview** — customers, total messages, credits consumed, and your
  upstream (Semaphore) balance so you know when to reload wholesale credits.
- **Users** — add/deduct credits manually, suspend/activate accounts.
- **Top-ups** — approve or reject customer top-up requests.
- **All Messages** — platform-wide traffic view.
- **Platform Settings** — upstream key, sender name, pricing, credit costs,
  welcome credits, payment instructions.

## Honest limits

- SMMSOFT is a reseller layer: delivery depends on your upstream Semaphore
  account (its credits, its approved sender name, telco delivery).
- Sender name is platform-wide (your one approved sender) — customers cannot
  use their own sender names unless you register more upstream and extend the
  platform.
- Outbound only — no inbox/replies (the upstream standard API has none).
- Messages starting with the word TEST are blocked (the network silently
  ignores them anyway).
- Top-ups are verified manually by the admin by design — pair the reference
  number with your GCash/bank records before approving.

## Files

- `config.php` — DB credentials + upstream defaults (keep private)
- `database.sql` — schema + admin account
- Public: `index.php` (landing), `register.php`, `login.php`, `logout.php`
- Customer: `dashboard.php`, `send.php`, `bulk.php`, `messages.php`,
  `contacts.php`, `credits.php`, `api.php`, `settings.php`
- Admin: `admin.php` (overview, users, top-ups, all messages, settings)
- API: `api/send.php`, `api/account.php`
- `lib/` — db + wallet, auth, upstream client, layout
