# LedgerKit

A spend and rewards ledger for Indian cards. It tracks expenses, refunds,
reimbursements, transfers, discounts, reward rules, and monthly or quarterly
reward caps.

## Local development

Node 22.5 or newer and a Postgres database are required.

```powershell
npm install
Copy-Item .env.example .env.local
# Edit .env.local and set DATABASE_URL
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:4400>. Use the dashboard or Settings to add optional demo
transactions.

For Supabase and Vercel setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Reward model

Every card defines its reward unit and value, card-wide cap, excluded categories,
and a set of editable rules. Rules can match merchants, categories, payment apps,
or channels and support percentage or points-per-block earnings. Caps reset by
month, quarter, year, or statement cycle.

Expenses are replayed in date order, so the transaction that actually exhausts a
cap is the one that stops earning. Received refunds reduce the eligible amount and
trigger a reward recalculation. Money is stored as integer paise and reward
quantities as integer milli-units; floating-point values never touch a balance.

## Stack

- Next.js 15 App Router, React 19, and TypeScript
- Supabase Postgres through Drizzle ORM and Postgres.js
- TanStack Query, Tailwind CSS, Radix UI, Motion, Recharts, Lucide, and Zod
- REST route handlers under `/api/*`

The Postgres client disables prepared statements for Supabase's transaction
pooler and reuses one connection per warm Vercel instance.

## Database commands

```bash
npm run db:generate  # generate a migration after schema changes
npm run db:migrate   # apply checked-in migrations
npm run db:push      # development-only direct schema sync
npm run db:seed      # seed reference data (idempotent on an initialized DB)
```

Migrations are explicit. They do not run during `next build` or a Vercel cold
start.

## Tests

```bash
npm test
npm run typecheck
python3 tests/api.e2e.py  # requires a running app and initialized database
```

The reward engine unit tests are pure and database-free.
