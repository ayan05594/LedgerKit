"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  Account,
  CardPayment,
  Category,
  Instrument,
  Merchant,
  PaymentApp,
  Person,
  RewardRule,
  Transfer,
  UserCardSelection,
} from "@/db/schema";
import type { CardCycleSummary } from "@/lib/cards/billing";
import type {
  CardSummary,
  ExpenseRow,
  MonthSummary,
  PendingSummary,
  PersonBalance,
  StandaloneReimbursementRow as ServerStandaloneReimbursementRow,
} from "@/server/queries";
import type { RewardOutcome, CapStatus } from "@/lib/rewards/engine";
import type { CardCatalogItem } from "@/lib/card-catalog";

async function request<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  const abort = () => controller.abort();
  rest.signal?.addEventListener("abort", abort, { once: true });

  let response: Response;
  try {
    const method = rest.method?.toUpperCase() ?? "GET";
    for (let attempt = 0; ; attempt += 1) {
      try {
        response = await fetch(url, {
          ...rest,
          signal: controller.signal,
          headers: json ? { "Content-Type": "application/json" } : undefined,
          body: json ? JSON.stringify(json) : rest.body,
        });
        break;
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(
            "The server took too long to respond. Please try again in a moment.",
          );
        }
        // A short DNS/Wi-Fi interruption should not replace the page with an
        // error. Reads are safe to retry once; writes are never repeated.
        if (method === "GET" && attempt === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          continue;
        }
        throw error;
      }
    }
  } finally {
    window.clearTimeout(timeout);
    rest.signal?.removeEventListener("abort", abort);
  }
  const responseText = await response.text();
  let payload:
    | { ok: true; data: T }
    | { ok: false; error: string }
    | null = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    // Vercel proxy/platform failures can be HTML or plain text. Preserve the
    // HTTP diagnostics below instead of replacing them with a generic toast.
  }
  if (!response.ok || !payload || payload.ok === false) {
    const apiMessage =
      payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : null;
    if (!apiMessage) {
      console.error("LedgerKit API request failed", {
        url,
        method: rest.method ?? "GET",
        status: response.status,
        contentType: response.headers.get("content-type"),
        vercelId: response.headers.get("x-vercel-id"),
        response: responseText.slice(0, 500),
      });
    }
    throw new Error(
      apiMessage ||
        (response.status >= 500
          ? `The server could not complete the request (${response.status}). Please try again.`
          : `Request failed (${response.status}). Please try again.`),
    );
  }
  return payload.data;
}

/* ----------------------------------------------------------------- types */

export interface AccountBalance {
  account: Account;
  balancePaise: number;
  spentPaise: number;
  refundedPaise: number;
  sentPaise: number;
  receivedPaise: number;
  cardPaymentsPaise: number;
}

export interface ReferenceData {
  categories: Category[];
  merchants: Merchant[];
  apps: PaymentApp[];
  instruments: Instrument[];
  accounts: Account[];
  people: Person[];
  rules: RewardRule[];
  accountBalances: AccountBalance[];
}

export interface CardSelectionData {
  catalog: CardCatalogItem[];
  selectedIds: string[];
  completed: boolean;
  skippedCards: boolean;
}

export interface SessionProfile {
  name: string;
  email: string;
}

export type RewardPreview = RewardOutcome & {
  rewardUnit: string;
  unitValuePaise: number;
  caps: CapStatus[];
};

export type TransferRow = Transfer & { personName: string; personColor: string };

export type StandaloneReimbursementRow = ServerStandaloneReimbursementRow;

export interface CardBillingRow {
  instrument: Instrument;
  selection: UserCardSelection;
  summary: CardCycleSummary;
  payments: CardPayment[];
}

/* ---------------------------------------------------------------- queries */

export const keys = {
  profile: ["session-profile"] as const,
  reference: ["reference"] as const,
  summary: (y: number, m: number) => ["summary", y, m] as const,
  expenses: (f: Record<string, unknown>) => ["expenses", f] as const,
  expense: (id: string) => ["expense", id] as const,
  instrument: (id: string, y: number) => ["instrument", id, y] as const,
  people: ["people"] as const,
  transfers: ["transfers"] as const,
  pending: ["pending"] as const,
  cardSelection: ["card-selection"] as const,
  cardBilling: ["card-billing"] as const,
};

export function useSessionProfile(enabled = true) {
  return useQuery({
    queryKey: keys.profile,
    queryFn: () => request<SessionProfile>("/api/auth/profile"),
    staleTime: Number.POSITIVE_INFINITY,
    enabled,
  });
}

export function useReference(enabled = true) {
  return useQuery({
    queryKey: keys.reference,
    queryFn: () => request<ReferenceData>("/api/reference"),
    staleTime: 60_000,
    enabled,
  });
}

export function useSummary(year: number, month: number) {
  return useQuery({
    queryKey: keys.summary(year, month),
    queryFn: () =>
      request<{ summary: MonthSummary }>(
        `/api/summary?year=${year}&month=${month}`,
      ),
  });
}

export function useExpenses(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const qs = params.toString();
  return useQuery({
    queryKey: keys.expenses(filters),
    queryFn: () => request<ExpenseRow[]>(`/api/expenses${qs ? `?${qs}` : ""}`),
  });
}

export function useExpense(id: string | null) {
  return useQuery({
    queryKey: keys.expense(id ?? ""),
    queryFn: () => request<ExpenseRow>(`/api/expenses/${id}`),
    enabled: !!id,
  });
}

export function useInstrument(id: string, year: number) {
  return useQuery({
    queryKey: keys.instrument(id, year),
    queryFn: () =>
      request<{
        instrument: Instrument;
        rules: RewardRule[];
        trend: { month: number; rewardPaise: number; netPaise: number }[];
      }>(`/api/instruments/${id}?year=${year}`),
  });
}

export function usePeople() {
  return useQuery({
    queryKey: keys.people,
    queryFn: () => request<PersonBalance[]>("/api/people"),
  });
}

export function useTransfers() {
  return useQuery({
    queryKey: keys.transfers,
    queryFn: () => request<TransferRow[]>("/api/transfers"),
  });
}

export function usePending() {
  return useQuery({
    queryKey: keys.pending,
    queryFn: () => request<PendingSummary>("/api/pending"),
  });
}

export function useCardSelection(enabled = true) {
  return useQuery({
    queryKey: keys.cardSelection,
    queryFn: () => request<CardSelectionData>("/api/card-selection"),
    staleTime: 60_000,
    enabled,
  });
}

export function useCardBilling(enabled = true) {
  return useQuery({
    queryKey: keys.cardBilling,
    queryFn: () => request<CardBillingRow[]>("/api/card-billing"),
    enabled,
  });
}

/* -------------------------------------------------------------- mutations */

function invalidateAll(qc: QueryClient) {
  qc.invalidateQueries();
}

/**
 * Every write touches spend totals, so we refresh broadly rather than trying
 * to patch caches by hand — the dataset is small and correctness matters more.
 */
function useWrite<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  successMessage?: string | ((data: TData, vars: TVars) => string),
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      invalidateAll(qc);
      if (successMessage) {
        toast.success(
          typeof successMessage === "function"
            ? successMessage(data, vars)
            : successMessage,
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateExpense() {
  return useWrite(
    (json: Record<string, unknown>) =>
      request<{ id: string }>("/api/expenses", { method: "POST", json }),
    "Expense added",
  );
}

export function useUpdateExpense() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request<{ id: string }>(`/api/expenses/${id}`, { method: "PATCH", json }),
    "Expense updated",
  );
}

export function useDeleteExpense() {
  return useWrite(
    (id: string) => request(`/api/expenses/${id}`, { method: "DELETE" }),
    "Expense deleted",
  );
}

export function useAddAdjustment() {
  return useWrite(
    ({ expenseId, ...json }: { expenseId: string } & Record<string, unknown>) =>
      request(`/api/expenses/${expenseId}/adjustments`, { method: "POST", json }),
    "Discount added",
  );
}

export function useUpdateAdjustment() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/adjustments/${id}`, { method: "PATCH", json }),
    "Discount updated",
  );
}

export function useDeleteAdjustment() {
  return useWrite(
    (id: string) => request(`/api/adjustments/${id}`, { method: "DELETE" }),
    "Discount removed",
  );
}

export function useAddRefund() {
  return useWrite(
    ({ expenseId, ...json }: { expenseId: string } & Record<string, unknown>) =>
      request(`/api/expenses/${expenseId}/refunds`, { method: "POST", json }),
    "Refund filed",
  );
}

export function useUpdateRefund() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/refunds/${id}`, { method: "PATCH", json }),
    "Refund updated",
  );
}

export function useDeleteRefund() {
  return useWrite(
    (id: string) => request(`/api/refunds/${id}`, { method: "DELETE" }),
    "Refund removed",
  );
}

export function useRecordReimbursement() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/expenses/${id}/reimbursement`, { method: "POST", json }),
    "Reimbursement recorded",
  );
}

export function useCreateStandaloneReimbursement() {
  return useWrite(
    (json: Record<string, unknown>) =>
      request<{ id: string }>("/api/reimbursements", { method: "POST", json }),
    "Reimbursement added",
  );
}

export function useUpdateStandaloneReimbursement() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request<{ id: string }>(`/api/reimbursements/${id}`, {
        method: "PATCH",
        json,
      }),
    "Reimbursement updated",
  );
}

export function useDeleteStandaloneReimbursement() {
  return useWrite(
    (id: string) => request(`/api/reimbursements/${id}`, { method: "DELETE" }),
    "Reimbursement deleted",
  );
}

export function useRecordStandaloneReimbursementReceipt() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/reimbursements/${id}/receipts`, { method: "POST", json }),
    "Payment recorded",
  );
}

export function useSaveCardSelection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: { instrumentIds: string[]; noCards: boolean }) =>
      request<{
        selectedIds: string[];
        instruments?: Instrument[];
        completed: true;
        reauthRequired: boolean;
        redirectTo?: string;
      }>("/api/card-selection", { method: "PUT", json }),
    onSuccess: (saved, variables) => {
      const selected = new Set(saved.selectedIds);
      // Remove deselected cards synchronously. If the background refetch is
      // interrupted, an expense form must never keep offering the old wallet.
      qc.setQueryData<ReferenceData>(keys.reference, (current) => {
        if (!current) return current;
        return {
          ...current,
          instruments:
            saved.instruments ??
            current.instruments.filter((instrument) =>
              selected.has(instrument.id),
            ),
          rules: current.rules.filter((rule) =>
            selected.has(rule.instrumentId),
          ),
        };
      });
      qc.setQueryData<CardSelectionData>(keys.cardSelection, (current) =>
        current
          ? {
              ...current,
              selectedIds: saved.selectedIds,
              completed: true,
              skippedCards: variables.noCards,
            }
          : current,
      );
      invalidateAll(qc);
      toast.success("Card choices saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateManualCard() {
  return useWrite(
    (json: {
      issuer: string;
      name: string;
      network: "visa" | "mastercard" | "rupay" | "amex" | "diners" | "other";
    }) =>
      request<CardCatalogItem>("/api/card-selection/manual", {
        method: "POST",
        json,
      }),
    "Manual card added",
  );
}

export function useUpdateInstrument() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/instruments/${id}`, { method: "PATCH", json }),
    "Card updated",
  );
}

export function useCreateInstrument() {
  return useWrite(
    (json: Record<string, unknown>) =>
      request<{ id: string }>("/api/instruments", { method: "POST", json }),
    "Card added",
  );
}

export function useDeleteInstrument() {
  return useWrite(
    (id: string) => request(`/api/instruments/${id}`, { method: "DELETE" }),
    "Card removed",
  );
}

export function useUpdateCardBilling() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/card-billing/${id}`, { method: "PATCH", json }),
    "Billing cycle saved",
  );
}

export function useCreateCardPayment() {
  return useWrite(
    ({ instrumentId, ...json }: { instrumentId: string } & Record<string, unknown>) =>
      request(`/api/card-billing/${instrumentId}/payments`, { method: "POST", json }),
    "Card payment recorded",
  );
}

export function useUpdateCardPayment() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/card-payments/${id}`, { method: "PATCH", json }),
    "Card payment updated",
  );
}

export function useDeleteCardPayment() {
  return useWrite(
    (id: string) => request(`/api/card-payments/${id}`, { method: "DELETE" }),
    "Card payment removed",
  );
}

export function useCreateRule() {
  return useWrite(
    ({ instrumentId, ...json }: { instrumentId: string } & Record<string, unknown>) =>
      request(`/api/instruments/${instrumentId}/rules`, { method: "POST", json }),
    "Rule added",
  );
}

export function useUpdateRule() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/rules/${id}`, { method: "PATCH", json }),
    "Rule saved",
  );
}

export function useDeleteRule() {
  return useWrite(
    (id: string) => request(`/api/rules/${id}`, { method: "DELETE" }),
    "Rule removed",
  );
}

export function useCreateAccount() {
  return useWrite(
    (json: Record<string, unknown>) =>
      request("/api/accounts", { method: "POST", json }),
    "Account added",
  );
}

export function useUpdateAccount() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/accounts/${id}`, { method: "PATCH", json }),
    "Account updated",
  );
}

export function useDeleteAccount() {
  return useWrite(
    (id: string) => request(`/api/accounts/${id}`, { method: "DELETE" }),
    "Account removed",
  );
}

export function useCreatePerson() {
  return useWrite(
    (json: Record<string, unknown>) => request("/api/people", { method: "POST", json }),
    "Person added",
  );
}

export function useUpdatePerson() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/people/${id}`, { method: "PATCH", json }),
    "Saved",
  );
}

export function useDeletePerson() {
  return useWrite(
    (id: string) => request(`/api/people/${id}`, { method: "DELETE" }),
    "Person removed",
  );
}

export function useCreateTransfer() {
  return useWrite(
    (json: Record<string, unknown>) =>
      request("/api/transfers", { method: "POST", json }),
    "Transfer recorded",
  );
}

export function useUpdateTransfer() {
  return useWrite(
    ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      request(`/api/transfers/${id}`, { method: "PATCH", json }),
    "Transfer updated",
  );
}

export function useDeleteTransfer() {
  return useWrite(
    (id: string) => request(`/api/transfers/${id}`, { method: "DELETE" }),
    "Transfer removed",
  );
}

export function useCreateCategory() {
  return useWrite(
    (json: Record<string, unknown>) =>
      request("/api/categories", { method: "POST", json }),
    "Category added",
  );
}

export function useCreateMerchant() {
  return useWrite((json: Record<string, unknown>) =>
    request("/api/merchants", { method: "POST", json }),
  );
}

export function useCreatePaymentApp() {
  return useWrite(
    (json: Record<string, unknown>) => request("/api/apps", { method: "POST", json }),
    "App added",
  );
}

export function useLoadDemo() {
  return useWrite(
    () => request<{ created: number }>("/api/demo", { method: "POST" }),
    (data) =>
      data.created > 0
        ? `Loaded ${data.created} sample transactions`
        : "Sample data is already loaded",
  );
}

export function useClearTransactions() {
  return useWrite(
    () => request("/api/reset", { method: "POST" }),
    "All transactions cleared",
  );
}

/* ---------------------------------------------------------------- preview */

export async function fetchRewardPreview(input: {
  instrumentId: string;
  amountPaise: number;
  occurredAt: string;
  categorySlug: string;
  merchantSlug: string | null;
  paymentAppSlug: string | null;
  channel: "online" | "offline" | "upi";
  flags?: Record<string, boolean>;
  excludeExpenseId?: string;
}) {
  return request<RewardPreview | null>("/api/reward-preview", {
    method: "POST",
    json: input,
  });
}
