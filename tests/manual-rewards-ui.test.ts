import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const expenseSheet = readFileSync(
  new URL("../src/components/expenses/expense-sheet.tsx", import.meta.url),
  "utf8",
);

assert.match(
  expenseSheet,
  /usesManualReward\s*=\s*\n\s*form\.payerKind === "card" && selectedCard\?\.rewardCoverage === "manual"/,
  "manual reward entry must require both a card payment and manual coverage",
);
assert.match(
  expenseSheet,
  /e\.rewardOverridePaise == null \? "" : String\(e\.rewardOverridePaise \/ 100\)/,
  "editing must initialize the INR field from the stored paise override",
);
assert.match(
  expenseSheet,
  /usesManualReward && rewardOverrideRaw !== ""[\s\S]*?\? toPaise\(rewardOverrideRaw\)[\s\S]*?: null/,
  "a blank field must submit null while a value is converted to paise",
);
assert.match(
  expenseSheet,
  /rewardOverridePaise,\s*\n\s*};/,
  "expense create and update payloads must include the manual override",
);
assert.match(
  expenseSheet,
  /\{usesManualReward && \([\s\S]*?Enter issuer-confirmed rewards only[\s\S]*?name="rewardOverrideAmount"/,
  "the accessible manual input and warning must remain behind the manual-card gate",
);

console.log("manual reward UI: manual cards can record an optional confirmed INR reward");
