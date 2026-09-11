import "server-only";

import { nanoid } from "nanoid";
import type {
  Account,
  Adjustment,
  CardPayment,
  Expense,
  Instrument,
  Refund,
  UserCardSelection,
} from "@/db/schema";
import { ApiError } from "@/lib/api";
import {
  computeCardCycle,
  type CardActivity,
  type CardCycleSummary,
} from "@/lib/cards/billing";
import { isBenefit } from "@/lib/derive";
import { todayISO } from "@/lib/rewards/periods";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseRows, toSupabaseRow } from "@/lib/supabase/rows";
import { requireOwnedAccount } from "@/server/ownership";

export interface CardBillingRow {
  instrument: Instrument;
  selection: UserCardSelection;
  summary: CardCycleSummary;
  payments: CardPayment[];
}

function stamp() {
  return new Date().toISOString();
}

async function requireSelection(userId: string, instrumentId: string) {
  const result = await createSupabaseAdminClient()
    .from("user_card_selections")
    .select("*")
    .eq("user_id", userId)
    .eq("instrument_id", instrumentId)
    .maybeSingle();
  if (result.error) throw result.error;
  const [selection] = fromSupabaseRows<UserCardSelection>(
    result.data ? [result.data] : [],
  );
  if (!selection) throw new ApiError("This card is not in your wallet.", 403);
  return selection;
}

export async function getCardBilling(
  userId: string,
  onlyInstrumentId?: string,
): Promise<CardBillingRow[]> {
  const admin = createSupabaseAdminClient();
  let selectionQuery = admin
    .from("user_card_selections")
    .select("*")
    .eq("user_id", userId);
  if (onlyInstrumentId) {
    selectionQuery = selectionQuery.eq("instrument_id", onlyInstrumentId);
  }
  const selectionResult = await selectionQuery;
  if (selectionResult.error) throw selectionResult.error;
  const selections = fromSupabaseRows<UserCardSelection>(selectionResult.data);
  if (!selections.length) return [];
  const instrumentIds = selections.map((row) => row.instrumentId);

  const [instrumentResult, expenseResult, paymentResult] = await Promise.all([
    admin.from("instruments").select("*").in("id", instrumentIds),
    admin
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .in("instrument_id", instrumentIds)
      .order("occurred_at")
      .limit(20000),
    admin
      .from("card_payments")
      .select("*")
      .eq("user_id", userId)
      .in("instrument_id", instrumentIds)
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  const firstError = [instrumentResult, expenseResult, paymentResult].find(
    (result) => result.error,
  )?.error;
  if (firstError) throw firstError;

  const instruments = fromSupabaseRows<Instrument>(instrumentResult.data);
  const expenses = fromSupabaseRows<Expense>(expenseResult.data);
  const payments = fromSupabaseRows<CardPayment>(paymentResult.data);
  const expenseIds = expenses.map((expense) => expense.id);
  const [adjustmentResult, refundResult] = expenseIds.length
    ? await Promise.all([
        admin
          .from("adjustments")
          .select("*")
          .eq("user_id", userId)
          .in("expense_id", expenseIds),
        admin
          .from("refunds")
          .select("*")
          .eq("user_id", userId)
          .in("expense_id", expenseIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (adjustmentResult.error) throw adjustmentResult.error;
  if (refundResult.error) throw refundResult.error;
  const adjustments = fromSupabaseRows<Adjustment>(adjustmentResult.data);
  const refunds = fromSupabaseRows<Refund>(refundResult.data);
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));

  return selections.flatMap((selection) => {
    const instrument = instruments.find(
      (card) => card.id === selection.instrumentId,
    );
    if (!instrument) return [];
    const cardExpenses = expenses.filter(
      (expense) => expense.instrumentId === instrument.id,
    );
    const charges: CardActivity[] = cardExpenses.map((expense) => {
      const rows = adjustments.filter(
        (adjustment) => adjustment.expenseId === expense.id,
      );
      const checkoutBenefits = rows
        .filter((row) => row.immediate && isBenefit(row.kind))
        .reduce((sum, row) => sum + row.amountPaise, 0);
      const fees = rows
        .filter((row) => !isBenefit(row.kind))
        .reduce((sum, row) => sum + row.amountPaise, 0);
      return {
        occurredAt: expense.occurredAt,
        amountPaise: Math.max(0, expense.amountPaise - checkoutBenefits + fees),
      };
    });
    const credits: CardActivity[] = refunds
      .filter((refund) => {
        if (refund.status !== "received") return false;
        if (refund.toInstrumentId) return refund.toInstrumentId === instrument.id;
        return expenseById.get(refund.expenseId)?.instrumentId === instrument.id;
      })
      .map((refund) => ({
        occurredAt: refund.refundedAt,
        amountPaise: refund.amountPaise,
      }));
    const cardPayments = payments.filter(
      (payment) => payment.instrumentId === instrument.id,
    );
    return [{
      instrument,
      selection,
      summary: computeCardCycle({
        today: todayISO(),
        config: {
          statementDay: selection.statementDay,
          dueOffsetDays: selection.dueOffsetDays,
          openingOutstandingPaise: selection.openingOutstandingPaise,
          openingDate: selection.openingDate,
        },
        charges,
        credits,
        payments: cardPayments,
      }),
      payments: cardPayments,
    }];
  });
}

export async function updateCardBillingConfig(
  userId: string,
  instrumentId: string,
  input: {
    statementDay: number;
    dueOffsetDays: number;
    repaymentAccountId: string | null;
    openingOutstandingPaise: number;
    openingDate: string;
    autopayMode: UserCardSelection["autopayMode"];
    autopayAmountPaise: number;
  },
) {
  await requireSelection(userId, instrumentId);
  await requireOwnedAccount(userId, input.repaymentAccountId);
  const result = await createSupabaseAdminClient()
    .from("user_card_selections")
    .update(toSupabaseRow({
      ...input,
      billingConfiguredAt: stamp(),
    }))
    .eq("user_id", userId)
    .eq("instrument_id", instrumentId)
    .select("instrument_id")
    .single();
  if (result.error) throw result.error;
  return instrumentId;
}

export async function createCardPayment(
  userId: string,
  instrumentId: string,
  input: { accountId: string | null; amountPaise: number; paidAt: string; note: string },
) {
  await requireSelection(userId, instrumentId);
  await requireOwnedAccount(userId, input.accountId);
  const row = {
    id: `cpay_${nanoid(14)}`,
    userId,
    instrumentId,
    ...input,
    createdAt: stamp(),
    updatedAt: stamp(),
  };
  const result = await createSupabaseAdminClient()
    .from("card_payments")
    .insert(toSupabaseRow(row));
  if (result.error) throw result.error;
  return row.id;
}

export async function updateCardPayment(
  userId: string,
  paymentId: string,
  input: { accountId: string | null; amountPaise: number; paidAt: string; note: string },
) {
  await requireOwnedAccount(userId, input.accountId);
  const result = await createSupabaseAdminClient()
    .from("card_payments")
    .update(toSupabaseRow({ ...input, updatedAt: stamp() }))
    .eq("id", paymentId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new ApiError("Card payment not found.", 404);
  return paymentId;
}

export async function deleteCardPayment(userId: string, paymentId: string) {
  const result = await createSupabaseAdminClient()
    .from("card_payments")
    .delete()
    .eq("id", paymentId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new ApiError("Card payment not found.", 404);
  return paymentId;
}
