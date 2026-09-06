import assert from "node:assert/strict";
import {
  deriveStandaloneReimbursementState,
  type StandaloneReimbursementState,
} from "../src/lib/reimbursements.ts";
import {
  standaloneReimbursementReceiptSchema,
  standaloneReimbursementSchema,
} from "../src/lib/validation.ts";

let passed = 0;

function test(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`  ok   ${name}`);
}

function state(
  expectedPaise: number,
  receiptAmounts: number[],
  writtenOff = false,
): StandaloneReimbursementState {
  return deriveStandaloneReimbursementState(
    { expectedPaise, writtenOff },
    receiptAmounts.map((amountPaise) => ({ amountPaise })),
  );
}

console.log("Standalone reimbursement validation");

const validClaim = {
  title: "  September fuel allowance  ",
  source: "  Acme payroll  ",
  kind: "fuel" as const,
  expectedPaise: 12_500,
  claimedAt: "2026-09-07",
  dueDate: "2026-09-30",
  notes: "  Submitted with the monthly report  ",
};

test("accepts and trims a valid claim", () => {
  const parsed = standaloneReimbursementSchema.safeParse(validClaim);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.title, "September fuel allowance");
  assert.equal(parsed.data.source, "Acme payroll");
  assert.equal(parsed.data.notes, "Submitted with the monthly report");
});

test("accepts a claim with no due date", () => {
  const parsed = standaloneReimbursementSchema.safeParse({
    ...validClaim,
    dueDate: null,
  });
  assert.equal(parsed.success, true);
});

test("rejects a blank title or payer", () => {
  assert.equal(
    standaloneReimbursementSchema.safeParse({ ...validClaim, title: "   " })
      .success,
    false,
  );
  assert.equal(
    standaloneReimbursementSchema.safeParse({ ...validClaim, source: "   " })
      .success,
    false,
  );
});

test("rejects zero, negative, and fractional claim amounts", () => {
  for (const expectedPaise of [0, -1, 10.5]) {
    assert.equal(
      standaloneReimbursementSchema.safeParse({
        ...validClaim,
        expectedPaise,
      }).success,
      false,
    );
  }
});

test("rejects unknown kinds and malformed dates", () => {
  assert.equal(
    standaloneReimbursementSchema.safeParse({
      ...validClaim,
      kind: "commute",
    }).success,
    false,
  );
  assert.equal(
    standaloneReimbursementSchema.safeParse({
      ...validClaim,
      claimedAt: "07/09/2026",
    }).success,
    false,
  );
  assert.equal(
    standaloneReimbursementSchema.safeParse({
      ...validClaim,
      dueDate: "30/09/2026",
    }).success,
    false,
  );
});

const validReceipt = {
  amountPaise: 4_000,
  receivedAt: "2026-09-15",
  note: "  First instalment  ",
};

test("accepts and trims a valid receipt", () => {
  const parsed = standaloneReimbursementReceiptSchema.safeParse(validReceipt);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.note, "First instalment");
});

test("rejects zero, negative, and fractional receipt amounts", () => {
  for (const amountPaise of [0, -1, 10.5]) {
    assert.equal(
      standaloneReimbursementReceiptSchema.safeParse({
        ...validReceipt,
        amountPaise,
      }).success,
      false,
    );
  }
});

test("rejects malformed receipt dates and oversized notes", () => {
  assert.equal(
    standaloneReimbursementReceiptSchema.safeParse({
      ...validReceipt,
      receivedAt: "15/09/2026",
    }).success,
    false,
  );
  assert.equal(
    standaloneReimbursementReceiptSchema.safeParse({
      ...validReceipt,
      note: "x".repeat(301),
    }).success,
    false,
  );
});

console.log("\nStandalone reimbursement state");

test("no receipts is pending with the full amount outstanding", () => {
  assert.deepEqual(state(10_000, []), {
    receivedPaise: 0,
    outstandingPaise: 10_000,
    status: "pending",
  });
});

test("some receipts is partial with only the remainder outstanding", () => {
  assert.deepEqual(state(10_000, [2_000, 3_500]), {
    receivedPaise: 5_500,
    outstandingPaise: 4_500,
    status: "partial",
  });
});

test("receipts equal to the claim settle it", () => {
  assert.deepEqual(state(10_000, [4_000, 6_000]), {
    receivedPaise: 10_000,
    outstandingPaise: 0,
    status: "settled",
  });
});

test("overpayment never creates a negative outstanding amount", () => {
  assert.deepEqual(state(10_000, [12_000]), {
    receivedPaise: 12_000,
    outstandingPaise: 0,
    status: "settled",
  });
});

test("written off overrides status and removes the outstanding amount", () => {
  assert.deepEqual(state(10_000, [2_500], true), {
    receivedPaise: 2_500,
    outstandingPaise: 0,
    status: "written_off",
  });
});

console.log(`\nStandalone reimbursements\n  ${passed} passed, 0 failed`);
