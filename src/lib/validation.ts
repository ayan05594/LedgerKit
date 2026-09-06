import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD form");

export const expenseSchema = z
  .object({
    occurredAt: isoDate,
    amountPaise: z
      .number()
      .int("Amount must be a whole number of paise")
      .positive("Amount has to be more than zero"),
    description: z.string().max(200).optional(),
    instrumentId: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    paymentAppSlug: z.string().nullable().optional(),
    categorySlug: z.string().min(1, "Pick a category"),
    customLabel: z.string().max(120).optional(),
    merchantSlug: z.string().nullable().optional(),
    merchantName: z.string().max(120).optional(),
    channel: z.enum(["online", "offline", "upi"]).optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional(),
    flags: z.record(z.string(), z.boolean()).optional(),
    reimbursable: z.boolean().optional(),
    reimbursementExpectedPaise: z.number().int().nonnegative().optional(),
    reimbursementFrom: z.string().max(160).optional(),
    reimbursementDueDate: isoDate.nullable().optional(),
    reimbursementNote: z.string().max(500).optional(),
    rewardOverridePaise: z.number().int().nullable().optional(),
  })
  .refine((v) => v.instrumentId || v.accountId, {
    message: "Choose the card or account this was paid from",
    path: ["instrumentId"],
  })
  .refine(
    (v) =>
      !v.reimbursable ||
      (v.reimbursementExpectedPaise ?? 0) <= v.amountPaise,
    {
      message: "Reimbursement cannot exceed the expense itself",
      path: ["reimbursementExpectedPaise"],
    },
  );

// ExpenseSheet submits the complete record on edit. Keep a named edit schema
// so the PATCH route never calls .partial() on a refined Zod object (Zod 4
// throws while constructing that schema, before an API response can be made).
export const expenseEditSchema = expenseSchema;

export const adjustmentSchema = z.object({
  label: z.string().min(1, "Give this discount a name").max(120),
  kind: z
    .enum([
      "instant_discount", "coupon", "bank_offer", "cashback",
      "reward_points", "gift_card", "fee", "surcharge", "other",
    ])
    .optional(),
  amountPaise: z.number().int().positive("Amount has to be more than zero"),
  immediate: z.boolean().optional(),
  status: z.enum(["expected", "received"]).optional(),
  receivedAt: isoDate.nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const refundSchema = z.object({
  amountPaise: z.number().int().positive("Refund has to be more than zero"),
  refundedAt: isoDate.optional(),
  status: z.enum(["pending", "received"]).optional(),
  reason: z.string().max(200).optional(),
  toInstrumentId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const transferSchema = z.object({
  direction: z.enum(["sent", "received"]),
  personId: z.string().nullable().optional(),
  amountPaise: z.number().int().positive("Amount has to be more than zero"),
  occurredAt: isoDate,
  instrumentId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  paymentAppSlug: z.string().nullable().optional(),
  purpose: z
    .enum(["gift", "loan", "repayment", "split", "shared", "salary", "other"])
    .optional(),
  countsAsSpend: z.boolean().optional(),
  note: z.string().max(300).optional(),
});

export const previewSchema = z.object({
  instrumentId: z.string().min(1),
  amountPaise: z.number().int().nonnegative(),
  occurredAt: isoDate,
  categorySlug: z.string().min(1),
  merchantSlug: z.string().nullable().optional().transform((v) => v ?? null),
  paymentAppSlug: z.string().nullable().optional().transform((v) => v ?? null),
  channel: z.enum(["online", "offline", "upi"]),
  flags: z.record(z.string(), z.boolean()).optional(),
  excludeExpenseId: z.string().optional(),
});

export type ExpenseFormValues = z.input<typeof expenseSchema>;
