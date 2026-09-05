import { pgTable, text, integer, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * All monetary values are stored as INTEGER paise (1 rupee = 100 paise) so that
 * arithmetic never drifts. Reward quantities are stored as "milli-units"
 * (units x 1000) so fractional points survive round-tripping.
 */

const now = sql`to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/* ----------------------------------------------------------------- accounts */

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  bank: text("bank").notNull().default(""),
  kind: text("kind", { enum: ["savings", "current", "wallet", "cash"] })
    .notNull()
    .default("savings"),
  last4: text("last4").notNull().default(""),
  balancePaise: integer("balance_paise").notNull().default(0),
  openingBalancePaise: integer("opening_balance_paise").notNull().default(0),
  openingDate: text("opening_date").notNull().default("2000-01-01"),
  colorHex: text("color_hex").notNull().default("#4B5563"),
  upiHandle: text("upi_handle").notNull().default(""),
  includeInTotals: boolean("include_in_totals")
    .notNull()
    .default(true),
  archived: boolean("archived").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(now),
});

/* -------------------------------------------------------------- instruments */
/** A card (credit / debit / prepaid). Debit cards link to a bank account. */

export const instruments = pgTable("instruments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  issuer: text("issuer").notNull(),
  network: text("network", {
    enum: ["visa", "rupay", "mastercard", "amex", "diners", "other"],
  })
    .notNull()
    .default("visa"),
  kind: text("kind", { enum: ["credit", "debit", "prepaid"] })
    .notNull()
    .default("credit"),
  last4: text("last4").notNull().default(""),
  colorFrom: text("color_from").notNull().default("#1F2937"),
  colorTo: text("color_to").notNull().default("#111827"),
  accountId: text("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  creditLimitPaise: integer("credit_limit_paise").notNull().default(0),
  statementDay: integer("statement_day").notNull().default(1),
  dueDay: integer("due_day").notNull().default(20),

  /** Unit the card pays rewards in, and what one unit is worth in paise. */
  rewardUnit: text("reward_unit").notNull().default("INR"),
  unitValuePaise: integer("unit_value_paise").notNull().default(100),
  rewardKind: text("reward_kind", {
    enum: ["statement_cashback", "points", "wallet_balance", "instant_cashback"],
  })
    .notNull()
    .default("statement_cashback"),

  /** Card-wide cap applied after per-rule caps (e.g. Millennia DC: Rs.400/month). */
  overallCapUnits: integer("overall_cap_units"),
  overallCapPeriod: text("overall_cap_period", {
    enum: ["month", "quarter", "year", "statement", "none"],
  })
    .notNull()
    .default("none"),

  /** Category slugs that never earn on this card, whatever the rule says. */
  excludedCategories: text("excluded_categories").notNull().default("[]"),
  /** Free-form knobs: { primeMember: true, sliceTierBps: 200 } */
  options: text("options").notNull().default("{}"),

  annualFeePaise: integer("annual_fee_paise").notNull().default(0),
  feeWaiverSpendPaise: integer("fee_waiver_spend_paise").notNull().default(0),
  forexMarkupBps: integer("forex_markup_bps").notNull().default(350),
  perks: text("perks").notNull().default("[]"),
  sourceNote: text("source_note").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(now),
});

/* ------------------------------------------------------------- reward rules */

export const rewardRules = pgTable(
  "reward_rules",
  {
    id: text("id").primaryKey(),
    instrumentId: text("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Higher wins when two rules match with equal specificity. */
    priority: integer("priority").notNull().default(0),
    isBase: boolean("is_base").notNull().default(false),

    matchMerchants: text("match_merchants").notNull().default("[]"),
    matchCategories: text("match_categories").notNull().default("[]"),
    matchApps: text("match_apps").notNull().default("[]"),
    channel: text("channel", {
      enum: ["any", "online", "offline", "upi"],
    })
      .notNull()
      .default("any"),

    rateType: text("rate_type", { enum: ["percent", "points_per_block"] })
      .notNull()
      .default("percent"),
    /** Basis points. 750 = 7.5%. Used when rateType = percent. */
    rateBps: integer("rate_bps").notNull().default(0),
    /** Used when rateType = points_per_block. */
    blockSizePaise: integer("block_size_paise").notNull().default(10000),
    pointsPerBlock: integer("points_per_block").notNull().default(0),

    minTxnPaise: integer("min_txn_paise").notNull().default(0),
    maxTxnPaise: integer("max_txn_paise"),

    /** Cap expressed in reward units. NULL = uncapped. */
    capUnits: integer("cap_units"),
    capPeriod: text("cap_period", {
      enum: ["month", "quarter", "year", "statement", "none"],
    })
      .notNull()
      .default("none"),
    /** Rules sharing a capGroup share one bucket. Defaults to the rule id. */
    capGroup: text("cap_group").notNull().default(""),

    excludeCategories: text("exclude_categories").notNull().default("[]"),
    excludeMerchants: text("exclude_merchants").notNull().default("[]"),

    /**
     * Only apply when the expense carries this flag with the matching value.
     * Lets one card hold both "Amazon with Prime" at 5% and "Amazon without
     * Prime" at 3% and pick between them per transaction.
     */
    requiresFlag: text("requires_flag"),
    requiresFlagValue: boolean("requires_flag_value")
      .notNull()
      .default(true),

    validFrom: text("valid_from"),
    validTo: text("valid_to"),
    active: boolean("active").notNull().default(true),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("rr_instrument_idx").on(t.instrumentId)],
);

/* --------------------------------------------------------------- taxonomy */

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull().default("Circle"),
  colorHex: text("color_hex").notNull().default("#6B7280"),
  parentSlug: text("parent_slug"),
  /** Miscellaneous / Other prompt for a free-text label on each expense. */
  requiresLabel: boolean("requires_label")
    .notNull()
    .default(false),
  isSystem: boolean("is_system").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const merchants = pgTable("merchants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  categorySlug: text("category_slug"),
  colorHex: text("color_hex").notNull().default("#6B7280"),
  isSystem: boolean("is_system").notNull().default(false),
});

export const paymentApps = pgTable("payment_apps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: text("kind", {
    enum: ["upi", "card", "netbanking", "wallet", "cash", "other"],
  })
    .notNull()
    .default("upi"),
  colorHex: text("color_hex").notNull().default("#6B7280"),
  isSystem: boolean("is_system").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* --------------------------------------------------------------- expenses */

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    occurredAt: text("occurred_at").notNull(), // YYYY-MM-DD
    amountPaise: integer("amount_paise").notNull(),
    description: text("description").notNull().default(""),

    /** Exactly one of instrumentId / accountId carries the payment. */
    instrumentId: text("instrument_id").references(() => instruments.id, {
      onDelete: "set null",
    }),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    paymentAppSlug: text("payment_app_slug"),

    categorySlug: text("category_slug").notNull(),
    customLabel: text("custom_label").notNull().default(""),
    merchantSlug: text("merchant_slug"),
    merchantName: text("merchant_name").notNull().default(""),
    channel: text("channel", { enum: ["online", "offline", "upi"] })
      .notNull()
      .default("online"),
    tags: text("tags").notNull().default("[]"),
    notes: text("notes").notNull().default(""),
    /** Answers to card conditions at the time of the spend, e.g. {"primeMember":true} */
    flags: text("flags").notNull().default("{}"),

    /* ---- reimbursement ---- */
    reimbursable: boolean("reimbursable")
      .notNull()
      .default(false),
    reimbursementExpectedPaise: integer("reimbursement_expected_paise")
      .notNull()
      .default(0),
    reimbursementReceivedPaise: integer("reimbursement_received_paise")
      .notNull()
      .default(0),
    reimbursementStatus: text("reimbursement_status", {
      enum: ["none", "pending", "partial", "settled", "written_off"],
    })
      .notNull()
      .default("none"),
    reimbursementFrom: text("reimbursement_from").notNull().default(""),
    reimbursementDueDate: text("reimbursement_due_date"),
    reimbursementNote: text("reimbursement_note").notNull().default(""),

    /* ---- engine output (derived, never hand-edited unless overridden) ---- */
    rewardRuleId: text("reward_rule_id"),
    rewardUnitsMilli: integer("reward_units_milli").notNull().default(0),
    rewardValuePaise: integer("reward_value_paise").notNull().default(0),
    rewardCappedUnitsMilli: integer("reward_capped_units_milli")
      .notNull()
      .default(0),
    rewardExplain: text("reward_explain").notNull().default(""),
    /** Set to override the engine for this one expense. */
    rewardOverridePaise: integer("reward_override_paise"),

    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    index("exp_date_idx").on(t.occurredAt),
    index("exp_instrument_idx").on(t.instrumentId, t.occurredAt),
    index("exp_category_idx").on(t.categorySlug),
  ],
);

/** Extra discounts, coupons, bank offers, fees — many per expense, editable. */
export const adjustments = pgTable(
  "adjustments",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    kind: text("kind", {
      enum: [
        "instant_discount",
        "coupon",
        "bank_offer",
        "cashback",
        "reward_points",
        "gift_card",
        "fee",
        "surcharge",
        "other",
      ],
    })
      .notNull()
      .default("instant_discount"),
    amountPaise: integer("amount_paise").notNull().default(0),
    /** true = reduced what you paid today; false = arrives later. */
    immediate: boolean("immediate")
      .notNull()
      .default(true),
    status: text("status", { enum: ["expected", "received"] })
      .notNull()
      .default("received"),
    receivedAt: text("received_at"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("adj_expense_idx").on(t.expenseId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    amountPaise: integer("amount_paise").notNull(),
    refundedAt: text("refunded_at").notNull(),
    status: text("status", { enum: ["pending", "received"] })
      .notNull()
      .default("received"),
    reason: text("reason").notNull().default(""),
    /** Where the money landed, if different from the original instrument. */
    toInstrumentId: text("to_instrument_id"),
    toAccountId: text("to_account_id"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("ref_expense_idx").on(t.expenseId)],
);

/* ---------------------------------------------------------- people & p2p */

export const people = pgTable("people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  relation: text("relation", {
    enum: ["friend", "family", "colleague", "flatmate", "merchant", "other"],
  })
    .notNull()
    .default("friend"),
  colorHex: text("color_hex").notNull().default("#6B7280"),
  upiHandle: text("upi_handle").notNull().default(""),
  phone: text("phone").notNull().default(""),
  notes: text("notes").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  createdAt: text("created_at").notNull().default(now),
});

export const transfers = pgTable(
  "transfers",
  {
    id: text("id").primaryKey(),
    direction: text("direction", { enum: ["sent", "received"] }).notNull(),
    personId: text("person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    amountPaise: integer("amount_paise").notNull(),
    occurredAt: text("occurred_at").notNull(),
    instrumentId: text("instrument_id"),
    accountId: text("account_id"),
    paymentAppSlug: text("payment_app_slug"),
    purpose: text("purpose", {
      enum: ["gift", "loan", "repayment", "split", "shared", "salary", "other"],
    })
      .notNull()
      .default("other"),
    /** Gifts and your share of a split are real spending; loans are not. */
    countsAsSpend: boolean("counts_as_spend")
      .notNull()
      .default(false),
    settlesTransferId: text("settles_transfer_id"),
    relatedExpenseId: text("related_expense_id"),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("tr_person_idx").on(t.personId), index("tr_date_idx").on(t.occurredAt)],
);

/* ------------------------------------------------------------- key/value */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type Instrument = typeof instruments.$inferSelect;
export type RewardRule = typeof rewardRules.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type PaymentApp = typeof paymentApps.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Adjustment = typeof adjustments.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
