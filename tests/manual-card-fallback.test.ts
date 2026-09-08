import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const schema = source("src/db/schema.ts");
const selection = source("src/server/card-selection.ts");
const route = source("src/app/api/card-selection/manual/route.ts");
const proxy = source("src/proxy.ts");
const picker = source("src/components/cards/card-selection.tsx");
const cardDetail = source("src/app/cards/[id]/page.tsx");
const cardDetailPage = cardDetail
  .split("export default function CardDetailPage() {")[1]
  ?.split("/* ------------------------------------------------------------------ rows */")[0] ?? "";
const queries = source("src/server/queries.ts");
const migration = source(
  "supabase/migrations/20260908194000_user_owned_manual_cards.sql",
);
const journal = source("supabase/migrations/meta/_journal.json");

assert.match(schema, /ownerUserId:\s*text\("owner_user_id"\)/);
assert.match(schema, /instrument_owner_idx/);
assert.match(route, /requireUserId\(\)/, "manual-card creation must require a user");
assert.match(route, /issuer:[\s\S]*min\(2\)\.max\(80\)/);
assert.match(route, /name:[\s\S]*min\(2\)\.max\(120\)/);
assert.match(route, /z\.enum\(\["visa", "mastercard", "rupay", "amex", "diners", "other"\]\)/);

assert.match(selection, /createManualCard[\s\S]*ownerUserId: userId/);
assert.match(selection, /createManualCard[\s\S]*rewardCoverage: "manual"/);
assert.match(selection, /createManualCard[\s\S]*isCatalogCard: false/);
assert.match(selection, /createManualCard[\s\S]*officialUrl: ""/);
assert.match(
  selection,
  /\.eq\("owner_user_id", userId\)/,
  "a user may only discover their own private cards",
);
assert.match(
  queries,
  /is_catalog_card\.eq\.true,owner_user_id\.eq\.\$\{userId\}/,
  "runtime reference reads must exclude another user's private card",
);

assert.match(proxy, /path\.startsWith\(`\$\{CARD_ONBOARDING_API\}\/`\)/);
assert.match(picker, /Add missing card/);
assert.match(picker, /Added by you/);
assert.match(picker, /Add and select card/);
assert.match(picker, /LedgerKit will not assume its fees, benefits, or reward rate/);
assert.match(cardDetailPage, /Private manual card/);
assert.match(cardDetailPage, /statement-confirmed rewards on[\s\S]*each expense/);
assert.doesNotMatch(
  cardDetailPage,
  /Add rule|RuleDialog|updateInstrument\.mutate/,
  "manual-card details must not expose controls backed by read-only APIs",
);

assert.match(migration, /ADD COLUMN "owner_user_id" text/);
assert.match(
  migration,
  /instruments\.owner_user_id = p_user_id[\s\S]*instruments\.reward_coverage = 'manual'/,
  "the atomic wallet RPC must reject another user's private card",
);
assert.match(
  migration,
  /REVOKE ALL[\s\S]*GRANT EXECUTE[\s\S]*service_role/,
  "only the trusted backend may replace a wallet",
);
assert.ok(journal.includes('"tag": "20260908194000_user_owned_manual_cards"'));

console.log("manual card fallback: private missing cards can be added and selected safely");
