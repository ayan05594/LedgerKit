# Deploy LedgerKit with Supabase and Vercel

LedgerKit is a Next.js application: Vercel runs both the UI and the `/api/*`
backend routes, while Supabase provides durable Postgres storage.

## What you need

- A Supabase project, its database password, and both connection URIs from the
  dashboard's **Connect** panel.
- A Vercel account connected to the Git repository (or the Vercel CLI).
- A decision about access control. LedgerKit is currently a single-ledger app
  with no login; a public Vercel URL would let anyone read or change the ledger.
- A decision about the existing `data/ledgerkit.db`: start with a clean database,
  seed only the built-in reference data, or migrate the existing local rows.

Never expose `DATABASE_URL` in browser code, prefix it with `NEXT_PUBLIC_`, or
commit it to Git.

## 1. Create the Supabase schema

For migration commands, use Supabase's direct URI (port 5432) when IPv6 is
available, or the session pooler URI (also port 5432) on an IPv4-only network.
Percent-encode special characters in the password when placing it in a URI.

In PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://..."
npm install
npm run db:migrate
npm run db:seed
```

`db:migrate` applies `supabase/migrations/20260905160000_initial_schema.sql`.
`db:seed` adds the built-in categories, merchants, payment apps, accounts, cards,
reward rules, and sample people. It does not add demo transactions.

Use one migration runner for a database. The commands above use Drizzle's
migration history; do not also apply the same file with `supabase db push`.

## 2. Configure Vercel

Add one environment variable to Production, Preview, and Development as needed:

```text
DATABASE_URL=<Supabase Transaction pooler URI on port 6543>
```

Use the **Transaction pooler** URI for Vercel's serverless runtime. The database
client already disables prepared statements, as required by transaction pooling.

Then import the repository in Vercel and deploy. Vercel detects Next.js; no build
or output overrides are required. A CLI deployment is equivalent:

```bash
vercel
vercel --prod
```

After deployment, check `/api/reference` and create one test expense before using
the ledger for real data.

## Ongoing schema changes

```bash
npm run db:generate
npm run db:migrate
```

Run migrations explicitly before deploying code that depends on them. They are
not executed during `next build` or during a Vercel cold start.
