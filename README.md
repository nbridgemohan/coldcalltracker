# coldcalltracker

Cold call tracker for selling website design/redesign to Trinidad & Tobago businesses.
Next.js 16 (App Router) + Neon Postgres, deployed on Vercel.

## Features

- **Lead list** – ~21k T&T businesses with phone, website status (none / social only / has site), owner/contact, category, area, Google rating. Filter, search, sort; tap a number to call.
- **Call queue** – "Start calling →" opens the best next uncalled lead (Priority A first, leads with a known owner first). "Save & next lead" keeps you moving through the current filtered list.
- **Call logging** – one-tap outcomes (no answer, voicemail, call back, interested, meeting, proposal, won, not interested, wrong number, do not call), notes, and an auto-suggested follow-up date.
- **Follow-ups** – due today/overdue and the next 7 days (Trinidad time).
- **Stats** – calls today/this week and the pipeline by status.
- **Password gate** – single team password (`APP_PASSWORD`), signed session cookie.

## Setup

```bash
npm install
vercel link                      # link to the Vercel project
vercel env pull .env.local       # DATABASE_URL, APP_PASSWORD, AUTH_SECRET
npm run db:migrate               # create tables
npm run db:import -- "C:\Users\nbrid\TT Website Leads\TT_Website_Leads_all.csv"
npm run dev
```

The lead CSV is **not** committed (the repo is public). Re-running the import refreshes lead details and keeps call history, statuses and manually edited owners.

## Deploys (CI/CD)

- Every push to `main` deploys to production on Vercel; every PR gets a preview deployment.
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck and a production build on pushes and PRs.
