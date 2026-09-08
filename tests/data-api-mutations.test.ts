import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/server/mutations.ts"),
  "utf8",
);

assert.doesNotMatch(source, /@\/db\/client|from\s+["']drizzle-orm["']/);
assert.doesNotMatch(source, /\bdb\.|\.transaction\(|\btx\./);
assert.match(source, /createSupabaseAdminClient/);

for (const table of [
  "expenses",
  "adjustments",
  "refunds",
  "standalone_reimbursements",
  "standalone_reimbursement_receipts",
  "instruments",
  "reward_rules",
  "accounts",
  "people",
  "transfers",
  "categories",
  "merchants",
  "payment_apps",
  "settings",
]) {
  assert.ok(source.includes(`.from("${table}")`), `${table} must use Data API`);
}

assert.match(
  source,
  /clearDerivedReward[\s\S]*rewardRuleId: null,[\s\S]*rewardUnitsMilli: 0,[\s\S]*rewardValuePaise: 0,[\s\S]*rewardCappedUnitsMilli: 0,[\s\S]*rewardExplain: ""/,
  "account, no-card, and manual-coverage edits must clear derived rewards",
);
assert.match(
  source,
  /deleteInstrument[\s\S]*instrumentId: null,[\s\S]*rewardRuleId: null,[\s\S]*rewardValuePaise: 0/,
  "removing a card must not leave its reward output on historical expenses",
);
assert.match(
  source,
  /recordStandaloneReimbursementReceipt[\s\S]*\.rpc\([\s\S]*"ledgerkit_record_standalone_receipt"/,
  "standalone receipts must use the atomic database function",
);

const atomicReceiptMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260908191000_atomic_reimbursement_receipts.sql",
  ),
  "utf8",
);
assert.match(
  atomicReceiptMigration,
  /FOR UPDATE;[\s\S]*already_received \+ p_amount_paise > expected_amount/,
  "the receipt function must lock its claim before checking the outstanding amount",
);
assert.match(
  atomicReceiptMigration,
  /REVOKE ALL[\s\S]*GRANT EXECUTE[\s\S]*service_role/,
  "only the trusted server role may record an atomic receipt",
);

console.log("mutation Data API regression checks passed");
