import assert from "node:assert/strict";
import test from "node:test";
import { computeCardCycle, statementWindow } from "../src/lib/cards/billing";

test("clamps a statement day to the final day of a short month", () => {
  assert.deepEqual(statementWindow("2027-02-28", 31), {
    cycleStart: "2027-02-01",
    statementDate: "2027-02-28",
    nextStatementDate: "2027-03-31",
  });
});

test("repayments reduce card liability without changing recorded spend", () => {
  const summary = computeCardCycle({
    today: "2026-09-30",
    config: {
      statementDay: 25,
      dueOffsetDays: 20,
      openingOutstandingPaise: 0,
      openingDate: "2026-08-01",
    },
    charges: [
      { occurredAt: "2026-09-10", amountPaise: 10_000_00 },
      { occurredAt: "2026-09-28", amountPaise: 2_000_00 },
    ],
    credits: [{ occurredAt: "2026-09-20", amountPaise: 1_000_00 }],
    payments: [{ paidAt: "2026-09-29", amountPaise: 4_000_00 }],
  });

  assert.equal(summary.statementBalancePaise, 9_000_00);
  assert.equal(summary.amountDuePaise, 5_000_00);
  assert.equal(summary.unbilledPaise, 2_000_00);
  assert.equal(summary.currentOutstandingPaise, 7_000_00);
  assert.equal(summary.dueDate, "2026-10-15");
});

test("returns outstanding before cycle setup", () => {
  const summary = computeCardCycle({
    today: "2026-09-10",
    config: {
      statementDay: null,
      dueOffsetDays: 20,
      openingOutstandingPaise: 500_00,
      openingDate: "2026-09-01",
    },
    charges: [{ occurredAt: "2026-09-05", amountPaise: 900_00 }],
    credits: [],
    payments: [],
  });
  assert.equal(summary.status, "not_configured");
  assert.equal(summary.currentOutstandingPaise, 1_400_00);
});
