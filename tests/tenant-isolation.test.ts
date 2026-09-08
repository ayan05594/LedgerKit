import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const schema = source("src/db/schema.ts");
const ownership = source("src/server/ownership.ts");
const mutations = source("src/server/mutations.ts");
const queries = source("src/server/queries.ts");
const cardSelection = source("src/server/card-selection.ts");
const seed = source("src/db/seed.ts");
const demoRoute = source("src/app/api/demo/route.ts");
const migration = source(
  "supabase/migrations/20260908183000_tenant_isolation.sql",
);
const catalogMigration = source(
  "supabase/migrations/20260908120000_card_catalog_onboarding.sql",
);
const journal = source("supabase/migrations/meta/_journal.json");

assert.match(
  schema,
  /userId:\s*text\("user_id"\)/,
  "accounts must carry a tenant owner",
);
assert.equal(
  (schema.match(/ownerUserId:\s*text\("owner_user_id"\)/g) ?? []).length,
  4,
  "manual instruments and personal taxonomy rows must carry an owner",
);
for (const indexName of [
  "accounts_user_idx",
  "categories_owner_idx",
  "merchants_owner_idx",
  "payment_apps_owner_idx",
]) {
  assert.ok(schema.includes(indexName), `${indexName} must stay in the schema`);
}

assert.match(
  ownership,
  /\.eq\("user_id", userId\)/,
  "owned ID validation must compare the authenticated user",
);
assert.match(
  ownership,
  /row\.is_system === true \|\| row\.owner_user_id === userId/,
  "taxonomy access must be system-or-owner only",
);
for (const validator of [
  "requireOwnedAccount",
  "requireOwnedPerson",
  "requireOwnedExpense",
  "requireOwnedTransfer",
  "requireAccessibleCategory",
  "requireAccessibleMerchant",
  "requireAccessiblePaymentApp",
]) {
  assert.ok(ownership.includes(`export async function ${validator}`));
}

assert.match(
  mutations,
  /createExpense[\s\S]*validateExpenseOwnershipReferences\(userId, input\)/,
  "expense creation must reject cross-tenant references",
);
assert.match(
  mutations,
  /createTransfer[\s\S]*validateTransferOwnershipReferences\(userId,/,
  "transfer creation must reject cross-tenant references",
);
assert.match(
  mutations,
  /createAccount[\s\S]*?\.from\("accounts"\)[\s\S]*?\.insert\(toSupabaseRow\(\{[\s\S]*?userId,/,
  "new accounts must be owned by their creator",
);
assert.match(
  mutations,
  /ownerUserId: userId/g,
  "new personal taxonomy rows must be owned by their creator",
);
assert.match(
  mutations,
  /updateAccount[\s\S]*?\.from\("accounts"\)[\s\S]*?\.eq\("id", rowId\)[\s\S]*?\.eq\("user_id", userId\)/,
  "account mutation targets must include the owner",
);

assert.equal(
  (schema.match(/\.enableRLS\(\)/g) ?? []).length,
  16,
  "every application table must keep RLS enabled in Drizzle metadata",
);

assert.match(
  queries,
  /from\("accounts"\)[\s\S]*?\.eq\("user_id", userId\)/,
  "account reads must be tenant-scoped",
);
assert.match(
  queries,
  /accessibleTaxonomyFilter\(userId\)/,
  "taxonomy reads must use the system-or-owner boundary",
);
assert.match(
  queries,
  /\.in\("id", accessibleInstrumentIds\)/,
  "reference cards must be restricted to the user's selections",
);
assert.match(
  queries,
  /\.in\("id", instrumentIds\)/,
  "historical cards must be hydrated by exact referenced IDs",
);
assert.match(
  queries,
  /accessibleInstrumentFilter\(userId\)/,
  "instrument reads must allow global catalogue cards or the authenticated user's manual cards",
);
assert.match(
  cardSelection,
  /is_catalog_card\.eq\.true,owner_user_id\.eq\.\$\{userId\}/,
  "selected-card reads must exclude another user's manual cards",
);

for (const column of [
  '"accounts" ADD COLUMN IF NOT EXISTS "user_id"',
  '"categories" ADD COLUMN IF NOT EXISTS "owner_user_id"',
  '"merchants" ADD COLUMN IF NOT EXISTS "owner_user_id"',
  '"payment_apps" ADD COLUMN IF NOT EXISTS "owner_user_id"',
]) {
  assert.ok(migration.includes(column), `migration is missing ${column}`);
}
assert.match(
  migration,
  /HAVING count\(DISTINCT user_id\) = 1/,
  "multi-user reconciliation must assign only uniquely inferred ownership",
);
assert.match(
  migration,
  /Rows whose[\s\S]*remain NULL and are quarantined/,
  "ambiguous legacy rows must remain quarantined",
);
assert.match(
  migration,
  /SET account_id = NULL, last4 = '', credit_limit_paise = 0[\s\S]*is_catalog_card = true/,
  "global catalogue cards must not retain personal account metadata",
);
assert.match(
  migration,
  /SET account_id = NULL, last4 = '', credit_limit_paise = 0, archived = true[\s\S]*is_catalog_card = false/,
  "private legacy instruments must be sanitized and archived",
);
assert.match(
  catalogMigration,
  /INSERT INTO "user_card_selections"[\s\S]*instruments\."is_catalog_card" = true[\s\S]*ON CONFLICT/,
  "migration preselection must never adopt a private legacy instrument",
);
assert.match(
  catalogMigration,
  /INTO valid_ids[\s\S]*instruments\.is_catalog_card = true[\s\S]*OR EXISTS \([\s\S]*existing_selection\.user_id = p_user_id/,
  "selection replacement may retain only an existing catalogue card",
);
for (const guard of [
  "accounts_owner_guard",
  "categories_owner_guard",
  "merchants_owner_guard",
  "payment_apps_owner_guard",
  "expenses_tenant_guard",
  "transfers_tenant_guard",
  "adjustments_tenant_guard",
  "refunds_tenant_guard",
  "standalone_receipts_tenant_guard",
]) {
  assert.ok(migration.includes(guard), `${guard} must remain installed`);
}
assert.ok(
  migration.includes("ledgerkit_tenant_isolation_audit"),
  "operators need a counts-only quarantine audit",
);
assert.ok(
  journal.includes('"tag": "20260908183000_tenant_isolation"'),
  "Drizzle journal must include the isolation migration",
);
assert.ok(
  journal.includes('"tag": "20260908190000_align_rls_schema"'),
  "Drizzle journal must preserve the RLS metadata alignment migration",
);

assert.doesNotMatch(
  seed,
  /const ACCOUNTS\b|\.values\(ACCOUNTS\)/,
  "normal reference seeding must not create global personal accounts",
);
assert.doesNotMatch(
  seed,
  /accountId:\s*["']acct-/,
  "global catalogue instruments must not point at personal accounts",
);
assert.match(
  demoRoute,
  /return fail\("Sample data is not available in production\.", 404\)/,
  "the obsolete fixture endpoint must not write hard-coded cross-tenant IDs",
);
assert.doesNotMatch(
  demoRoute,
  /loadDemoData/,
  "the production API must not invoke obsolete sample-data mutations",
);

console.log("tenant isolation regression checks passed");
