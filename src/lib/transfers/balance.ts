export const balanceTreatments = [
  "creates_receivable",
  "settles_receivable",
  "creates_payable",
  "settles_payable",
  "none",
] as const;

export type BalanceTreatment = (typeof balanceTreatments)[number];

export interface BalanceTransfer {
  amountPaise: number;
  direction: "sent" | "received";
  purpose: string;
  countsAsSpend: boolean;
  balanceTreatment?: BalanceTreatment | null;
  occurredAt?: string;
  createdAt?: string;
}

export function inferBalanceTreatment(
  transfer: Pick<
    BalanceTransfer,
    "direction" | "purpose" | "countsAsSpend"
  >,
): BalanceTreatment {
  if (
    transfer.countsAsSpend ||
    transfer.purpose === "gift" ||
    transfer.purpose === "salary" ||
    transfer.purpose === "other"
  ) {
    return "none";
  }
  if (transfer.purpose === "loan") {
    return transfer.direction === "sent"
      ? "creates_receivable"
      : "creates_payable";
  }
  if (transfer.purpose === "repayment") {
    return transfer.direction === "sent"
      ? "settles_payable"
      : "settles_receivable";
  }
  return transfer.direction === "sent"
    ? "creates_receivable"
    : "settles_receivable";
}

export function derivePersonDebtBalance(transfers: BalanceTransfer[]) {
  let owedToYouPaise = 0;
  let youOwePaise = 0;
  const ordered = [...transfers].sort((a, b) => {
    const dateOrder = (a.occurredAt ?? "").localeCompare(b.occurredAt ?? "");
    return dateOrder || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });

  for (const transfer of ordered) {
    const amount = Math.max(0, transfer.amountPaise);
    const treatment =
      transfer.balanceTreatment ?? inferBalanceTreatment(transfer);
    if (treatment === "creates_receivable") owedToYouPaise += amount;
    if (treatment === "settles_receivable") {
      owedToYouPaise = Math.max(0, owedToYouPaise - amount);
    }
    if (treatment === "creates_payable") youOwePaise += amount;
    if (treatment === "settles_payable") {
      youOwePaise = Math.max(0, youOwePaise - amount);
    }
  }

  return {
    owedToYouPaise,
    youOwePaise,
    netPaise: owedToYouPaise - youOwePaise,
  };
}
