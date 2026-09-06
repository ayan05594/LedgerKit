import type {
  StandaloneReimbursement,
  StandaloneReimbursementReceipt,
} from "@/db/schema";

export type StandaloneReimbursementStatus =
  | "pending"
  | "partial"
  | "settled"
  | "written_off";

export interface StandaloneReimbursementState {
  receivedPaise: number;
  outstandingPaise: number;
  status: StandaloneReimbursementStatus;
}

/**
 * Standalone claims keep their payment history as individual receipt rows.
 * Deriving the aggregate here gives every API response one consistent view and
 * avoids maintaining a second, drift-prone received total in the database.
 */
export function deriveStandaloneReimbursementState(
  claim: Pick<StandaloneReimbursement, "expectedPaise" | "writtenOff">,
  receipts: readonly Pick<StandaloneReimbursementReceipt, "amountPaise">[],
): StandaloneReimbursementState {
  const receivedPaise = receipts.reduce(
    (total, receipt) => total + Math.max(0, receipt.amountPaise),
    0,
  );

  if (claim.writtenOff) {
    return { receivedPaise, outstandingPaise: 0, status: "written_off" };
  }

  const outstandingPaise = Math.max(0, claim.expectedPaise - receivedPaise);
  const status: StandaloneReimbursementStatus =
    receivedPaise <= 0
      ? "pending"
      : outstandingPaise > 0
        ? "partial"
        : "settled";

  return { receivedPaise, outstandingPaise, status };
}
