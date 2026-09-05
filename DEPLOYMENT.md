# Deploy LedgerKit with Supabase and Vercel

LedgerKit is a Next.js application: Vercel runs both the UI and the `/api/*`
backend routes, while Supabase provides durable Postgres storage.

## What you need

- A Supabase project, its database password, and both connection URIs from the
  dashboard's **Connect** panel.
- A Vercel account connected to the Git repository (or the Vercel CLI).
- A private registration secret that you will share only with allowed users.
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

`db:migrate` applies the checked-in migrations, including the initial schema
and the user-ownership columns required by authentication.
`db:seed` adds the built-in categories, merchants, payment apps, accounts, cards,
reward rules, and sample people. It does not add demo transactions.

Use one migration runner for a database. The commands above use Drizzle's
migration history; do not also apply the same file with `supabase db push`.

## 2. Configure Vercel

Add these environment variables to Production, Preview, and Development as
needed:

```text
DATABASE_URL=<Supabase Transaction pooler URI on port 6543>
NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_SECRET_KEY=<Supabase server secret key>
REGISTRATION_SECRET=<private secret entered during registration>
```

The server secret and registration secret must remain server-only. Registration
creates an email/password user with email already confirmed, so no OTP or
confirmation email is required. Expenses, refunds, adjustments, transfers, and
demo-data state are scoped to the signed-in Supabase user.

Use the **Transaction pooler** URI for Vercel's serverless runtime. The database
client already disables prepared statements, as required by transaction pooling.

Then import the repository in Vercel and deploy. Vercel detects Next.js; no build
or output overrides are required. A CLI deployment is equivalent:

```bash
vercel
vercel --prod
```

After deployment, open `/register`, create the first account, and create one test
expense before using the ledger for real data.

## Ongoing schema changes

```bash
npm run db:generate
npm run db:migrate
```

Run migrations explicitly before deploying code that depends on them. They are
not executed during `next build` or during a Vercel cold start.
