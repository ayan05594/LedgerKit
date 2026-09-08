import assert from "node:assert/strict";
import { expenseEditSchema } from "../src/lib/validation";

const completeEditPayload = {
  occurredAt: "2026-09-03",
  amountPaise: 34900,
  description: "",
  instrumentId: "card_millennia",
  accountId: null,
  paymentAppSlug: "card-online",
  categorySlug: "mobile-recharge",
  customLabel: "",
  merchantSlug: "airtel",
  merchantName: "",
  channel: "online" as const,
  flags: {},
  notes: "",
  reimbursable: false,
  reimbursementExpectedPaise: 0,
  reimbursementFrom: "",
  reimbursementDueDate: null,
  reimbursementNote: "",
};

const valid = expenseEditSchema.safeParse(completeEditPayload);
assert.equal(valid.success, true, "the complete edit form payload must validate");

const missingPayer = expenseEditSchema.safeParse({
  ...completeEditPayload,
  instrumentId: null,
});
assert.equal(
  missingPayer.success,
  false,
  "an edit without a card or account must be rejected",
);

const excessiveReimbursement = expenseEditSchema.safeParse({
  ...completeEditPayload,
  reimbursable: true,
  reimbursementExpectedPaise: completeEditPayload.amountPaise + 1,
});
assert.equal(
  excessiveReimbursement.success,
  false,
  "reimbursement cannot exceed the expense amount",
);

console.log("Expense edit validation\n  3 passed, 0 failed");
