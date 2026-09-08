import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CREDIT_CARD_CATALOG,
  CREDIT_CARD_CATALOG_META,
  CREDIT_CARD_CATALOG_VERIFIED_AT,
  CREDIT_CARD_ISSUER_SOURCES,
  CREDIT_CARD_STARTER_CATALOG,
} from "../src/data/credit-card-catalog";
import { CREDIT_CARD_CATALOG_EXTRA_A } from "../src/data/credit-card-catalog-extra-a";
import { CREDIT_CARD_CATALOG_EXTRA_B } from "../src/data/credit-card-catalog-extra-b";
import {
  CREDIT_CARD_CATALOG_VERSION,
  CREDIT_CARD_INSTRUMENT_SEEDS,
  catalogProductIdentity,
} from "../src/data/credit-card-seed";
import {
  MANUAL_REWARD_EXPLANATION,
  manualRewardOutcome,
  rewardAutomationEnabled,
} from "../src/lib/rewards/coverage";

const extendedCatalog = [
  ...CREDIT_CARD_CATALOG_EXTRA_A,
  ...CREDIT_CARD_CATALOG_EXTRA_B,
];

const issuerHosts = new Set(
  CREDIT_CARD_ISSUER_SOURCES.map(({ url }) => new URL(url).hostname),
);
const issuerHostByName = new Map<string, string>(
  CREDIT_CARD_ISSUER_SOURCES.map(({ issuer, url }) => [
    issuer,
    new URL(url).hostname,
  ]),
);
const ids = CREDIT_CARD_CATALOG.map(({ id }) => id);
const storageIds = CREDIT_CARD_STARTER_CATALOG.map(
  ({ id, aliases }) => aliases[0] ?? `card-catalog-${id}`,
);

assert.equal(
  CREDIT_CARD_CATALOG.length,
  CREDIT_CARD_STARTER_CATALOG.length,
  "the discovery and seed catalogues must stay aligned",
);
assert.ok(
  CREDIT_CARD_CATALOG.length >= 40,
  "the initial India catalogue should retain broad issuer coverage",
);
assert.ok(
  CREDIT_CARD_INSTRUMENT_SEEDS.length >= 290,
  "production seed must publish the researched card catalogue",
);
assert.equal(
  new Set(CREDIT_CARD_INSTRUMENT_SEEDS.map(({ id }) => id)).size,
  CREDIT_CARD_INSTRUMENT_SEEDS.length,
  "production instrument IDs must be unique",
);
assert.equal(
  new Set(
    CREDIT_CARD_INSTRUMENT_SEEDS.map(({ issuer, name }) =>
      catalogProductIdentity(issuer, name),
    ),
  ).size,
  CREDIT_CARD_INSTRUMENT_SEEDS.length,
  "production instruments must not contain duplicate normalized products",
);
assert.equal(new Set(ids).size, ids.length, "catalogue IDs must be unique");
assert.equal(
  new Set(storageIds).size,
  storageIds.length,
  "database storage IDs and legacy aliases must be unique",
);
assert.equal(CREDIT_CARD_CATALOG_META.market, "India");
assert.match(CREDIT_CARD_CATALOG_VERIFIED_AT, /^\d{4}-\d{2}-\d{2}$/);

for (const card of CREDIT_CARD_CATALOG) {
  assert.ok(card.name.trim(), `${card.id} must have a name`);
  assert.ok(card.issuer.trim(), `${card.id} must have an issuer`);
  assert.ok(card.rewardSummary.trim(), `${card.id} must have a reward summary`);
  assert.ok(card.highlights.length > 0, `${card.id} must have a highlight`);
  assert.equal(card.verifiedAt, CREDIT_CARD_CATALOG_VERIFIED_AT);

  const source = new URL(card.sourceUrl);
  assert.equal(source.protocol, "https:", `${card.id} must use an HTTPS source`);
  assert.ok(
    issuerHosts.has(source.hostname),
    `${card.id} must link to an issuer-owned host (${source.hostname})`,
  );

  for (const fee of [card.fees.joiningInr, card.fees.annualInr]) {
    assert.ok(
      fee === null || (Number.isFinite(fee) && fee >= 0),
      `${card.id} contains an invalid fee`,
    );
  }
}

for (const card of CREDIT_CARD_STARTER_CATALOG) {
  assert.equal(
    card.rewardCoverage,
    "headline-summary",
    `${card.id} must not present a marketing summary as a calculation rule`,
  );
}

assert.ok(
  extendedCatalog.length >= 140,
  "the official-name catalogue should retain broad Indian issuer coverage",
);
assert.equal(
  new Set(extendedCatalog.map(({ id }) => id)).size,
  extendedCatalog.length,
  "extended catalogue IDs must be unique",
);

for (const card of extendedCatalog) {
  assert.ok(card.name.trim(), `${card.id} must have a name`);
  assert.ok(card.issuer.trim(), `${card.id} must have an issuer`);
  assert.equal(
    new URL(card.officialUrl).protocol,
    "https:",
    `${card.id} must use an HTTPS issuer source`,
  );
  assert.ok(
    ["active", "invite_only", "secured", "applications_paused", "discontinued"].includes(
      card.availability,
    ),
    `${card.id} has an invalid availability`,
  );
  assert.equal(
    new URL(card.officialUrl).hostname,
    issuerHostByName.get(card.issuer),
    `${card.id} must link to its issuer-owned catalogue host`,
  );
}

assert.ok(
  new Set([
    ...CREDIT_CARD_CATALOG.map(({ issuer }) => issuer),
    ...extendedCatalog.map(({ issuer }) => issuer),
  ]).size >= 15,
  "catalogue should cover at least 15 major Indian issuers",
);

assert.deepEqual(
  CREDIT_CARD_STARTER_CATALOG
    .flatMap(({ aliases }) => aliases)
    .sort(),
  [
    "card-amazon-pay-icici",
    "card-flipkart-axis",
    "card-hdfc-millennia-cc",
  ].sort(),
  "the three legacy catalogue IDs must remain stable",
);

const estimatedCatalogCards = CREDIT_CARD_INSTRUMENT_SEEDS
  .filter(({ rewardCoverage }) => rewardCoverage === "partial")
  .map(({ id }) => id)
  .sort();
assert.deepEqual(
  estimatedCatalogCards,
  ["card-hdfc-millennia-cc"],
  "only the maintained HDFC Millennia calculator may produce estimates",
);
for (const id of ["card-flipkart-axis", "card-amazon-pay-icici"]) {
  const card = CREDIT_CARD_INSTRUMENT_SEEDS.find((item) => item.id === id);
  assert.ok(card, id + " must remain in the selectable catalogue");
  assert.equal(card.rewardCoverage, "manual");
  assert.equal(
    card.unitValuePaise,
    0,
    id + " must not retain calculator conversion metadata",
  );
  assert.equal(
    (JSON.parse(card.options) as { flags?: unknown }).flags,
    undefined,
    id + " must not ask calculator-specific questions while tracking rewards manually",
  );
}
for (const card of CREDIT_CARD_INSTRUMENT_SEEDS.filter(
  ({ rewardCoverage }) => rewardCoverage === "partial",
)) {
  assert.ok(
    card.unitValuePaise > 0,
    `${card.id} must have a usable INR conversion for its estimate`,
  );
}
assert.equal(
  CREDIT_CARD_CATALOG_VERSION,
  "india-2026-09-08-v5",
  "the estimate coverage policy must invalidate an older catalogue sync marker",
);
assert.equal(rewardAutomationEnabled({ rewardCoverage: "manual" }), false);
assert.equal(rewardAutomationEnabled({ rewardCoverage: "partial" }), true);
assert.equal(rewardAutomationEnabled({ rewardCoverage: "exact" }), true);
assert.equal(
  CREDIT_CARD_INSTRUMENT_SEEDS.filter(({ rewardCoverage }) => rewardCoverage === "exact").length,
  0,
  "no catalogue card may claim exact coverage",
);
assert.equal(
  CREDIT_CARD_INSTRUMENT_SEEDS.filter(({ rewardCoverage }) => rewardCoverage === "manual").length,
  CREDIT_CARD_INSTRUMENT_SEEDS.length - 1,
  "every catalogue card without a maintained calculator must remain manual",
);
assert.deepEqual(manualRewardOutcome(), {
  ruleId: null,
  ruleName: "Manual tracking",
  unitsMilli: 0,
  valuePaise: 0,
  cappedUnitsMilli: 0,
  explain: MANUAL_REWARD_EXPLANATION,
});

for (const card of CREDIT_CARD_INSTRUMENT_SEEDS) {
  assert.equal(card.verifiedAt, CREDIT_CARD_CATALOG_VERIFIED_AT);
  assert.ok(
    ["active", "invite_only", "secured", "applications_paused", "discontinued"].includes(
      card.availability,
    ),
    `${card.id} has an invalid projected availability`,
  );
  assert.equal(new URL(card.officialUrl).protocol, "https:");
  assert.equal(
    new URL(card.officialUrl).hostname,
    issuerHostByName.get(card.issuer),
    `${card.id} must retain an issuer-owned source host`,
  );
  if (!card.annualFeeKnown) {
    assert.equal(
      card.annualFeePaise,
      0,
      `${card.id} must not encode an unknown annual fee as a known charge`,
    );
  }
  if (!card.joiningFeeKnown) {
    assert.equal(
      card.joiningFeePaise,
      0,
      `${card.id} must not encode an unknown joining fee as a known charge`,
    );
  }
}

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260908120000_card_catalog_onboarding.sql",
    import.meta.url,
  ),
  "utf8",
);
const migratedCatalogIds = [...migration.matchAll(/^  \('([^']+)'/gm)]
  .map((match) => match[1]!)
  .filter((id) => id.startsWith("card-"));
assert.deepEqual(
  new Set(migratedCatalogIds),
  new Set(CREDIT_CARD_INSTRUMENT_SEEDS.map(({ id }) => id)),
  "the timestamped migration must physically contain the current projection",
);
assert.equal(
  migratedCatalogIds.length,
  CREDIT_CARD_INSTRUMENT_SEEDS.length,
  "the timestamped migration must not insert duplicate catalogue rows",
);
assert.match(
  migration,
  /ADD COLUMN "is_catalog_card" boolean DEFAULT false NOT NULL/,
  "unverified legacy cards must be private by default",
);
assert.match(
  migration,
  /FROM public\.user_onboarding[\s\S]*FOR UPDATE;/,
  "card selection replacement must serialize per user",
);
assert.match(
  migration,
  /INSERT INTO "user_onboarding" \([\s\S]*SELECT\s+users\."id"::text,\s+NULL,\s+false\s+FROM "auth"\."users"/,
  "every account that predates onboarding must make a fresh wallet choice on its next login",
);
assert.match(
  migration,
  /"fee_note", "perks", "source_note",\s*\n\s*"catalog_category"/,
  "migration-only deploys must retain researched perks and caveats",
);
assert.doesNotMatch(
  migration,
  /SET "reward_coverage" = 'exact'/,
  "stale calculator rows must not promote catalogue cards to exact coverage",
);
assert.match(
  migration,
  /SET "reward_coverage" = CASE[\s\S]*THEN 'partial'[\s\S]*ELSE 'manual'/,
  "the migration must keep partial estimates explicit and every other catalogue card manual",
);

const seedSource = readFileSync(
  new URL("../src/db/seed.ts", import.meta.url),
  "utf8",
);
assert.match(
  seedSource,
  /const manualCatalogCardIds = CARDS[\s\S]*?!PARTIAL_REWARD_CARD_IDS\.has\(card\.id\)[\s\S]*?delete\(rewardRules\)[\s\S]*?inArray\(rewardRules\.instrumentId, manualCatalogCardIds\)/,
  "idempotent seeding must remove stale executable rules from manual catalogue cards",
);
assert.match(
  seedSource,
  /const publishRules =\s*!isCatalogCard \|\| PARTIAL_REWARD_CARD_IDS\.has\(card\.id\);[\s\S]*?\(publishRules \? card\.rules : \[\]\)/,
  "idempotent seeding must publish rules only for maintained catalogue calculators",
);
assert.doesNotMatch(
  seedSource,
  /id: "(?:fka|api)-/,
  "manual Flipkart Axis and Amazon Pay ICICI calculators must not remain in the seed",
);

const partialCalculatorMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260908192000_partial_reward_calculators.sql",
    import.meta.url,
  ),
  "utf8",
);
for (const ruleId of [
  "mcc-smartbuy-downgrade",
  "mcc-partners",
  "mcc-base",
]) {
  assert.ok(
    partialCalculatorMigration.includes(`'${ruleId}'`),
    `${ruleId} must be installed by migrations, not only by the optional seed`,
  );
}
assert.match(
  partialCalculatorMigration,
  /estimate, not a statement replica/i,
  "the maintained calculator must remain explicitly partial",
);
assert.match(
  partialCalculatorMigration,
  /SET reward_coverage = 'manual'[\s\S]*?'card-flipkart-axis'[\s\S]*?'card-amazon-pay-icici'/,
  "calculators with unresolved statement-cycle and transaction-classification gaps must be manual",
);
assert.match(
  partialCalculatorMigration,
  /excluded_categories = '\["fuel","rent","taxes","credit-card-bill","wallet-load","emi"\]'/,
  "HDFC Millennia exclusions must follow the maintained issuer terms",
);
assert.match(
  partialCalculatorMigration,
  /'mcc-partners'[\s\S]*?'mcc-accelerated', '\["gift-cards"\]'/,
  "gift-card purchases at accelerated merchants must fall through to the 1% base rule",
);
assert.doesNotMatch(
  partialCalculatorMigration,
  /'(?:fka|api)-/,
  "manual catalogue cards must not retain production reward rules",
);

console.log(
  `credit-card catalogue: ${CREDIT_CARD_INSTRUMENT_SEEDS.length} unique projected cards (${CREDIT_CARD_INSTRUMENT_SEEDS.filter(({ availability }) => availability !== "discontinued").length} selectable)`,
);
