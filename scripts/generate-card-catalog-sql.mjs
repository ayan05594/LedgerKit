import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import {
  CREDIT_CARD_CATALOG_VERSION,
  CREDIT_CARD_INSTRUMENT_SEEDS,
} from "../src/data/credit-card-seed.ts";

export const CATALOG_SQL_BATCH_SIZE = 20;

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const boolean = (value) => (value ? "true" : "false");

function valuesRow(row) {
  return [
    quote(row.id),
    quote(row.name),
    quote(row.shortName),
    quote(row.issuer),
    quote(row.network),
    quote(row.kind),
    quote(row.colorFrom),
    quote(row.colorTo),
    quote(row.rewardUnit),
    row.unitValuePaise,
    quote(row.rewardKind),
    row.annualFeePaise,
    boolean(row.annualFeeKnown),
    row.joiningFeePaise,
    boolean(row.joiningFeeKnown),
    quote(row.feeNote),
    quote(row.perks),
    quote(row.sourceNote),
    quote(row.options),
    quote(row.catalogCategory),
    quote(row.catalogSummary),
    quote(row.officialUrl),
    quote(row.termsUrl),
    quote(row.verifiedAt),
    quote(row.availability),
    quote(row.rewardCoverage),
    "true",
    "false",
    row.sortOrder,
  ].join(", ");
}

function insertBatch(rows, index) {
  const heading = index === 0
    ? `-- Generated from src/data/credit-card-seed.ts. Re-run
-- npm run db:catalog:sql after updating the checked-in research catalogue.
`
    : "";
  return `${heading}INSERT INTO "instruments" (
  "id", "name", "short_name", "issuer", "network", "kind",
  "color_from", "color_to", "reward_unit", "unit_value_paise", "reward_kind",
  "annual_fee_paise", "annual_fee_known", "joining_fee_paise",
  "joining_fee_known", "fee_note", "perks", "source_note", "options",
  "catalog_category", "catalog_summary",
  "official_url", "terms_url", "verified_at", "availability",
  "reward_coverage", "is_catalog_card", "archived", "sort_order"
)
VALUES
${rows.map((row) => `  (${valuesRow(row)})`).join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "catalog_category" = EXCLUDED."catalog_category",
  "catalog_summary" = EXCLUDED."catalog_summary",
  "perks" = EXCLUDED."perks",
  "source_note" = EXCLUDED."source_note",
  "options" = EXCLUDED."options",
  "official_url" = EXCLUDED."official_url",
  "terms_url" = EXCLUDED."terms_url",
  "verified_at" = EXCLUDED."verified_at",
  "availability" = EXCLUDED."availability",
  "reward_coverage" = EXCLUDED."reward_coverage",
  "is_catalog_card" = true,
  "archived" = false,
  "sort_order" = EXCLUDED."sort_order",
  "annual_fee_paise" = CASE
    WHEN EXCLUDED."annual_fee_known" THEN EXCLUDED."annual_fee_paise"
    ELSE "instruments"."annual_fee_paise"
  END,
  "annual_fee_known" = "instruments"."annual_fee_known" OR EXCLUDED."annual_fee_known",
  "joining_fee_paise" = CASE
    WHEN EXCLUDED."joining_fee_known" THEN EXCLUDED."joining_fee_paise"
    ELSE "instruments"."joining_fee_paise"
  END,
  "joining_fee_known" = "instruments"."joining_fee_known" OR EXCLUDED."joining_fee_known",
  "fee_note" = CASE
    WHEN EXCLUDED."fee_note" <> '' THEN EXCLUDED."fee_note"
    ELSE "instruments"."fee_note"
  END;--> statement-breakpoint`;
}

function footer() {
  const partialIds = CREDIT_CARD_INSTRUMENT_SEEDS
    .filter((row) => row.rewardCoverage === "partial")
    .map((row) => quote(row.id))
    .join(", ");
  return `-- Keep stale catalogue rows conservative. Only the explicitly
-- maintained legacy calculators may run, and they remain estimates.
UPDATE "instruments"
SET "reward_coverage" = CASE
  WHEN "id" IN (${partialIds}) THEN 'partial'
  ELSE 'manual'
END
WHERE "is_catalog_card" = true;--> statement-breakpoint

INSERT INTO "settings" ("key", "value")
VALUES ('credit_card_catalog_version', ${quote(CREDIT_CARD_CATALOG_VERSION)})
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";--> statement-breakpoint`;
}

export function generateCardCatalogSqlBatches() {
  const batches = [];
  for (
    let start = 0;
    start < CREDIT_CARD_INSTRUMENT_SEEDS.length;
    start += CATALOG_SQL_BATCH_SIZE
  ) {
    const index = batches.length;
    batches.push(
      insertBatch(
        CREDIT_CARD_INSTRUMENT_SEEDS.slice(
          start,
          start + CATALOG_SQL_BATCH_SIZE,
        ),
        index,
      ),
    );
  }
  batches[batches.length - 1] += `\n\n${footer()}`;
  return batches;
}

export function generateCardCatalogSql() {
  return generateCardCatalogSqlBatches().join("\n\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const writeArgument = process.argv.find((value) =>
    value.startsWith("--write-migration="),
  );
  if (writeArgument) {
    const file = writeArgument.slice("--write-migration=".length);
    const current = readFileSync(file, "utf8");
    const startMarker = "-- Generated from src/data/credit-card-seed.ts.";
    const endMarker = "-- Preselect only cards that an existing user has actually used.";
    const start = current.indexOf(startMarker);
    const end = current.indexOf(endMarker, start);
    if (start < 0 || end < 0) {
      throw new Error("Could not locate the generated catalogue block.");
    }
    const next =
      current.slice(0, start) +
      generateCardCatalogSql() +
      "\n\n" +
      current.slice(end);
    writeFileSync(file, next, "utf8");
    process.stdout.write(
      `Updated ${file} with ${CREDIT_CARD_INSTRUMENT_SEEDS.length} catalogue rows.\n`,
    );
    process.exit(0);
  }
  const batchArgument = process.argv.find((value) => value.startsWith("--batch="));
  const batches = generateCardCatalogSqlBatches();
  const output = process.argv.includes("--ids")
    ? CREDIT_CARD_INSTRUMENT_SEEDS.map(({ id }) => id).join("\n")
    : batchArgument
      ? batches[Number.parseInt(batchArgument.slice("--batch=".length), 10)]
      : generateCardCatalogSql();
  if (!output) throw new Error(`Unknown catalogue SQL batch: ${batchArgument}`);
  process.stdout.write(`${output}\n`);
}
