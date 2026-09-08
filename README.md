# LedgerKit

A spend and rewards ledger for Indian cards. It tracks expenses, refunds,
reimbursements, transfers, discounts, reward rules, and monthly or quarterly
reward caps.

## Local development

Node 22.5 or newer and a Supabase project are required.

```powershell
npm install
Copy-Item .env.example .env.local
# Fill in the Supabase and registration values documented in .env.example
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:4400>, register, and choose the cards in your wallet.
Card selection is mandatory (with an explicit no-credit-card option), and can
be changed later under Settings. If an issuer product is not in the curated
catalogue, add its bank and printed card name as a private manual-tracking card;
LedgerKit does not invent fees or reward rules for it.

For Supabase and Vercel setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Reward model

The card picker is seeded from issuer-owned Indian card catalogues. A card marked
**Partial estimate** has reviewed calculator rules, but the result is explicitly
an estimate because not every current issuer exclusion, cap, or redemption term
is modeled. A **Manual tracking** card is available for expense attribution but
does not claim an estimated reward. Users can enter the reward confirmed on their
issuer statement for those expenses. After source revalidation, no catalogue
card claims exact coverage. One maintained HDFC Millennia calculator provides a
clearly labelled estimate; every other catalogue card remains manual until its full
current terms can be modelled safely.

Implemented rules can match merchants, categories, payment apps, or channels and
support percentage or points-per-block earnings. Caps reset by month, quarter,
year, or statement cycle. Official card links and verification dates are shown in
the product so users can confirm time-sensitive fees, exclusions, and benefits.

Expenses are replayed in date order, so the transaction that actually exhausts a
cap is the one that stops earning. Received refunds reduce the eligible amount and
trigger a reward recalculation. Money is stored as integer paise and reward
quantities as integer milli-units; floating-point values never touch a balance.

## Stack

- Next.js 16 App Router, React 19, and TypeScript
- Supabase Postgres, with runtime reads and writes through the Supabase Data API
- Drizzle ORM and Postgres.js for explicit schema migrations and maintenance
- TanStack Query, Tailwind CSS, Radix UI, Motion, Recharts, Lucide, and Zod
- REST route handlers under `/api/*`

User-owned rows are scoped to the signed-in Supabase user. The global card and
reference catalogues are read-only through normal application routes.

## Database commands

```bash
npm run db:generate  # generate a migration after schema changes
npm run db:migrate   # apply checked-in migrations
npm run db:push      # development-only direct schema sync
npm run db:seed      # seed reference data (idempotent on an initialized DB)
npm run db:catalog:sql # regenerate the checked-in card catalogue SQL block
```

Migrations are explicit. They do not run during `next build` or a Vercel cold
start.

## Tests

```bash
npm test
npm run typecheck
python tests/api.e2e.py   # read-only smoke check; requires a running app/database
```

The reward engine unit tests are pure and database-free.
