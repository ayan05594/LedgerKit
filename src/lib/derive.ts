import type { Adjustment, Expense, Refund } from "@/db/schema";

export const BENEFIT_KINDS = [
  "instant_discount",
  "coupon",
  "bank_offer",
  "cashback",
  "reward_points",
  "gift_card",
] as const;

export const COST_KINDS = ["fee", "surcharge"] as const;

export function isBenefit(kind: Adjustment["kind"]) {
  return (BENEFIT_KINDS as readonly string[]).includes(kind);
}

export interface ExpenseMath {
  /** Ticket price before anything is taken off. */
  grossPaise: number;
  /** Refunds already back in your account. */
  refundedPaise: number;
  /** Refunds you have raised but not yet received. */
  refundPendingPaise: number;
  /** Discounts that reduced what you paid at checkout. */
  instantDiscountPaise: number;
  /** Convenience fees and surcharges added on top. */
  feesPaise: number;
  /** Cashback or offers that land later, logged by hand. */
  deferredBenefitPaise: number;
  /** What the card's own reward programme paid, from the engine. */
  rewardValuePaise: number;
  /** Reward you did not get because a cap was already full. */
  rewardLostToCapPaise: number;
  /** Amount someone else owes you back. */
  reimbursementExpectedPaise: number;
  reimbursementReceivedPaise: number;
  reimbursementOutstandingPaise: number;

  /** Money that actually left your account. */
  outOfPocketPaise: number;
  /** Out of pocket less reimbursements already received. */
  netSpendPaise: number;
  /** Net spend less every reward and deferred benefit — the real cost. */
  effectiveCostPaise: number;
  /** Everything still owed to you on this line. */
  receivablePaise: number;
  /** Total value clawed back, as a share of gross. */
  savingsRatePct: number;
}

export function computeExpenseMath(
  expense: Pick<
    Expense,
    | "amountPaise"
    | "rewardValuePaise"
    | "rewardCappedUnitsMilli"
    | "reimbursable"
    | "reimbursementExpectedPaise"
    | "reimbursementReceivedPaise"
  > & { unitValuePaise?: number },
  adjustments: Adjustment[] = [],
  refunds: Refund[] = [],
): ExpenseMath {
  const grossPaise = expense.amountPaise;

  let refundedPaise = 0;
  let refundPendingPaise = 0;
  for (const r of refunds) {
    if (r.status === "received") refundedPaise += r.amountPaise;
    else refundPendingPaise += r.amountPaise;
  }

  let instantDiscountPaise = 0;
  let feesPaise = 0;
  let deferredBenefitPaise = 0;
  for (const a of adjustments) {
    if (isBenefit(a.kind)) {
      if (a.immediate) instantDiscountPaise += a.amountPaise;
      else if (a.status === "received") deferredBenefitPaise += a.amountPaise;
      else deferredBenefitPaise += a.amountPaise;
    } else {
      feesPaise += a.amountPaise;
    }
  }

  const rewardValuePaise = expense.rewardValuePaise;
  const rewardLostToCapPaise = Math.round(
    (expense.rewardCappedUnitsMilli * (expense.unitValuePaise ?? 100)) / 1000,
  );

  const reimbursementExpectedPaise = expense.reimbursable
    ? expense.reimbursementExpectedPaise
    : 0;
  const reimbursementReceivedPaise = expense.reimbursable
    ? expense.reimbursementReceivedPaise
    : 0;
  const reimbursementOutstandingPaise = Math.max(
    0,
    reimbursementExpectedPaise - reimbursementReceivedPaise,
  );

  const outOfPocketPaise =
    grossPaise - refundedPaise - instantDiscountPaise + feesPaise;
  const netSpendPaise = outOfPocketPaise - reimbursementReceivedPaise;
  const effectiveCostPaise =
    netSpendPaise - rewardValuePaise - deferredBenefitPaise;
  const receivablePaise = reimbursementOutstandingPaise + refundPendingPaise;

  const clawedBack =
    instantDiscountPaise + rewardValuePaise + deferredBenefitPaise;
  const savingsRatePct = grossPaise > 0 ? (clawedBack / grossPaise) * 100 : 0;

  return {
    grossPaise,
    refundedPaise,
    refundPendingPaise,
    instantDiscountPaise,
    feesPaise,
    deferredBenefitPaise,
    rewardValuePaise,
    rewardLostToCapPaise,
    reimbursementExpectedPaise,
    reimbursementReceivedPaise,
    reimbursementOutstandingPaise,
    outOfPocketPaise,
    netSpendPaise,
    effectiveCostPaise,
    receivablePaise,
    savingsRatePct,
  };
}

export function emptyMath(): ExpenseMath {
  return computeExpenseMath(
    {
      amountPaise: 0,
      rewardValuePaise: 0,
      rewardCappedUnitsMilli: 0,
      reimbursable: false,
      reimbursementExpectedPaise: 0,
      reimbursementReceivedPaise: 0,
    },
    [],
    [],
  );
}

export function sumMath(rows: ExpenseMath[]): ExpenseMath {
  const total = emptyMath();
  for (const r of rows) {
    total.grossPaise += r.grossPaise;
    total.refundedPaise += r.refundedPaise;
    total.refundPendingPaise += r.refundPendingPaise;
    total.instantDiscountPaise += r.instantDiscountPaise;
    total.feesPaise += r.feesPaise;
    total.deferredBenefitPaise += r.deferredBenefitPaise;
    total.rewardValuePaise += r.rewardValuePaise;
    total.rewardLostToCapPaise += r.rewardLostToCapPaise;
    total.reimbursementExpectedPaise += r.reimbursementExpectedPaise;
    total.reimbursementReceivedPaise += r.reimbursementReceivedPaise;
    total.reimbursementOutstandingPaise += r.reimbursementOutstandingPaise;
    total.outOfPocketPaise += r.outOfPocketPaise;
    total.netSpendPaise += r.netSpendPaise;
    total.effectiveCostPaise += r.effectiveCostPaise;
    total.receivablePaise += r.receivablePaise;
  }
  const clawedBack =
    total.instantDiscountPaise +
    total.rewardValuePaise +
    total.deferredBenefitPaise;
  total.savingsRatePct =
    total.grossPaise > 0 ? (clawedBack / total.grossPaise) * 100 : 0;
  return total;
}
