# SMMSOFT — Public Website

The public website for **SMMSOFT**, an SMS provider platform for Philippine
businesses (bulk SMS, priority delivery, and OTP, with a developer API).

This is a plain static site — no build step:

- `index.html` — landing page
- `pricing.html` — pricing + a working SMS cost calculator
- `api.html` — API documentation (matches the SMMSOFT platform API)
- `assets/style.css`, `assets/app.js`

## Deploy on Vercel

1. Import this repository in Vercel (**Add New → Project**).
2. Framework preset: **Other**. No build command, no output directory
   settings needed — the root of the repo is the site.
3. Deploy. Every push to `main` re-deploys automatically.

## Relationship to the platform

This website is the public face. The working platform (customer accounts,
credits, sending, admin panel) is the separate SMMSOFT PHP application,
hosted on a PHP + MySQL server; the API docs here describe its endpoints.
