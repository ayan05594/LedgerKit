import "server-only";

import { ApiError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function invalidReference(label: string): never {
  throw new ApiError(`${label} is not available for this account.`, 422);
}

async function ownedIdExists(
  admin: AdminClient,
  table: "accounts" | "people" | "expenses" | "transfers",
  userId: string,
  id: string,
) {
  const result = await admin.from(table).select("id").eq("id", id)
    .eq("user_id", userId).maybeSingle();
  if (result.error) throw result.error;
  return !!result.data;
}

async function accessibleSlugExists(
  admin: AdminClient,
  table: "categories" | "merchants" | "payment_apps",
  userId: string,
  slug: string,
) {
  const result = await admin.from(table).select("is_system,owner_user_id")
    .eq("slug", slug);
  if (result.error) throw result.error;
  return (result.data ?? []).some(
    (row) => row.is_system === true || row.owner_user_id === userId,
  );
}

export async function requireOwnedAccount(
  userId: string,
  accountId: string | null | undefined,
  admin = createSupabaseAdminClient(),
) {
  if (!accountId) return;
  if (!(await ownedIdExists(admin, "accounts", userId, accountId))) {
    invalidReference("Account");
  }
}

export async function requireOwnedPerson(
  userId: string,
  personId: string | null | undefined,
  admin = createSupabaseAdminClient(),
) {
  if (!personId) return;
  if (!(await ownedIdExists(admin, "people", userId, personId))) {
    invalidReference("Person");
  }
}

export async function requireOwnedExpense(
  userId: string,
  expenseId: string | null | undefined,
  admin = createSupabaseAdminClient(),
) {
  if (!expenseId) return;
  if (!(await ownedIdExists(admin, "expenses", userId, expenseId))) {
    invalidReference("Expense");
  }
}

export async function requireOwnedTransfer(
  userId: string,
  transferId: string | null | undefined,
  admin = createSupabaseAdminClient(),
) {
  if (!transferId) return;
  if (!(await ownedIdExists(admin, "transfers", userId, transferId))) {
    invalidReference("Transfer");
  }
}

export async function requireAccessibleCategory(
  userId: string,
  categorySlug: string | null | undefined,
  admin = createSupabaseAdminClient(),
) {
  if (!categorySlug) invalidReference("Category");
  if (!(await accessibleSlugExists(admin, "categories", userId, categorySlug))) {
    invalidReference("Category");
  }
}

export async function requireAccessibleMerchant(
  userId: string,
  merchantSlug: string | null | undefined,
  admin = createSupabaseAdminClient(),
) {
  if (!merchantSlug) return;
  if (!(await accessibleSlugExists(admin, "merchants", userId, merchantSlug))) {
    invalidReference("Merchant");
  }
}

export async function requireAccessiblePaymentApp(
  userId: string,
  paymentAppSlug: string | null | undefined,
  admin = createSupabaseAdminClient(),
) {
  if (!paymentAppSlug) return;
  if (!(await accessibleSlugExists(admin, "payment_apps", userId, paymentAppSlug))) {
    invalidReference("Payment method");
  }
}

export async function validateExpenseOwnershipReferences(
  userId: string,
  input: {
    accountId?: string | null;
    categorySlug?: string | null;
    merchantSlug?: string | null;
    paymentAppSlug?: string | null;
  },
) {
  const admin = createSupabaseAdminClient();
  await Promise.all([
    requireOwnedAccount(userId, input.accountId, admin),
    requireAccessibleCategory(userId, input.categorySlug, admin),
    requireAccessibleMerchant(userId, input.merchantSlug, admin),
    requireAccessiblePaymentApp(userId, input.paymentAppSlug, admin),
  ]);
}

export async function validateTransferOwnershipReferences(
  userId: string,
  input: {
    accountId?: string | null;
    personId?: string | null;
    paymentAppSlug?: string | null;
    relatedExpenseId?: string | null;
    settlesTransferId?: string | null;
  },
) {
  const admin = createSupabaseAdminClient();
  await Promise.all([
    requireOwnedAccount(userId, input.accountId, admin),
    requireOwnedPerson(userId, input.personId, admin),
    requireAccessiblePaymentApp(userId, input.paymentAppSlug, admin),
    requireOwnedExpense(userId, input.relatedExpenseId, admin),
    requireOwnedTransfer(userId, input.settlesTransferId, admin),
  ]);
}
