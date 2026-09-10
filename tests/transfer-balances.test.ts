import assert from "node:assert/strict";
import {
  derivePersonDebtBalance,
  inferBalanceTreatment,
  type BalanceTransfer,
} from "../src/lib/transfers/balance";

let passed = 0;

function test(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`  ok   ${name}`);
}

function transfer(
  patch: Partial<BalanceTransfer> & Pick<BalanceTransfer, "amountPaise">,
): BalanceTransfer {
  return {
    direction: "received",
    purpose: "other",
    countsAsSpend: false,
    ...patch,
  };
}

console.log("Transfer debt balances");

test("ordinary money received does not create a debt", () => {
  assert.deepEqual(
    derivePersonDebtBalance([
      transfer({ amountPaise: 2_000, balanceTreatment: "none" }),
    ]),
    { owedToYouPaise: 0, youOwePaise: 0, netPaise: 0 },
  );
});

test("an unmatched repayment received cannot flip into money you owe", () => {
  assert.deepEqual(
    derivePersonDebtBalance([
      transfer({
        amountPaise: 5_000,
        purpose: "repayment",
        balanceTreatment: "settles_receivable",
      }),
    ]),
    { owedToYouPaise: 0, youOwePaise: 0, netPaise: 0 },
  );
});

test("a partial repayment reduces only the amount they owe", () => {
  const result = derivePersonDebtBalance([
    transfer({
      amountPaise: 7_000,
      direction: "sent",
      purpose: "loan",
      balanceTreatment: "creates_receivable",
      occurredAt: "2026-09-01",
    }),
    transfer({
      amountPaise: 5_000,
      purpose: "repayment",
      balanceTreatment: "settles_receivable",
      occurredAt: "2026-09-02",
    }),
  ]);
  assert.deepEqual(result, {
    owedToYouPaise: 2_000,
    youOwePaise: 0,
    netPaise: 2_000,
  });
});

test("money borrowed explicitly creates an amount you owe", () => {
  assert.deepEqual(
    derivePersonDebtBalance([
      transfer({
        amountPaise: 3_000,
        purpose: "loan",
        balanceTreatment: "creates_payable",
      }),
    ]),
    { owedToYouPaise: 0, youOwePaise: 3_000, netPaise: -3_000 },
  );
});

test("paying someone back cannot create a receivable", () => {
  assert.deepEqual(
    derivePersonDebtBalance([
      transfer({
        amountPaise: 4_000,
        direction: "sent",
        purpose: "repayment",
        balanceTreatment: "settles_payable",
      }),
    ]),
    { owedToYouPaise: 0, youOwePaise: 0, netPaise: 0 },
  );
});

test("legacy intent inference keeps other receipts balance-neutral", () => {
  assert.equal(
    inferBalanceTreatment({
      direction: "received",
      purpose: "other",
      countsAsSpend: false,
    }),
    "none",
  );
});

console.log(`\nTransfer debt balances: ${passed} passed, 0 failed`);
