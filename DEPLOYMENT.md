# Deploy LedgerKit with Supabase and Vercel

LedgerKit is a Next.js application: Vercel runs both the UI and the `/api/*`
backend routes, while Supabase provides durable Postgres storage.

## What you need

- A Supabase project, its database password, and both connection URIs from the
  dashboard's **Connect** panel.
- A Vercel account connected to the Git repository (or the Vercel CLI).
- A private registration secret that you will share only with allowed users.

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

`db:migrate` applies the checked-in migrations, including authentication
ownership, the issuer card catalogue, mandatory card onboarding, and per-user
wallet selection. `db:seed` is an idempotent maintenance command for the global
reference catalogue. It does not add demo transactions or personal accounts.

Use one migration runner for a database. The commands above use Drizzle's
migration history; do not also apply the same file with `supabase db push`.

## 2. Configure Vercel

Add these four runtime environment variables to Production, Preview, and
Development as needed:

```text
NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_SECRET_KEY=<Supabase server secret key>
REGISTRATION_SECRET=<private secret entered during registration>
```

The server secret and registration secret must remain server-only. Registration
creates an email/password user with email already confirmed, so no OTP or
confirmation email is required. On first sign-in every user must select the
credit cards they hold, or explicitly choose that they use no credit card.
Cards missing from the issuer catalogue can be added as private manual-tracking
cards without making unverified reward claims.
Expenses, accounts, people, refunds, adjustments, transfers, reimbursements,
custom reference rows, and demo-data state are scoped to the signed-in Supabase
user. Runtime reads and writes use Supabase's HTTPS Data API; they do not open a
Postgres connection from a Vercel function. `DATABASE_URL` is therefore not
required in Vercel. Keep it only in a secure maintenance environment if you run
Drizzle migrations or seeding there.

Then import the repository in Vercel and deploy. Vercel detects Next.js; no build
or output overrides are required. A CLI deployment is equivalent:

```bash
vercel
vercel --prod
```

No additional environment variable is required for card onboarding. After
deployment, open `/api/health` and verify that `ok`, `catalogReady`,
`cardSelectionReady`, `manualCardReady`, and `ownershipReady` are all `true`.
Then open `/register`, create the first account, complete card selection, and
create one test expense before using the ledger for real data.

## Ongoing schema changes

```bash
npm run db:generate
npm run db:migrate
```

Run migrations explicitly before deploying code that depends on them. They are
not executed during `next build` or during a Vercel cold start.

If Supabase's GitHub integration is enabled for production deployments, let it
be the only production migration runner. Before the first rollout, compare its
migration history with the production database (`supabase migration list`). If
the existing schema was originally applied with Drizzle, mark only the versions
you have verified as already present; do not blindly rerun both histories. Take
a database backup before the ownership migration because legacy shared demo-card
details are deliberately sanitized while user-specific ownership is introduced.

The checked-in card catalogue includes an issuer URL and verification date. Run
`npm run db:catalog:sql` only after updating the researched TypeScript catalogue;
review and commit the resulting migration change together so production does not
depend on a first-request catalogue sync.
