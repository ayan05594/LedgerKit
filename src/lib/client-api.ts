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
  Category,
  Instrument,
  Merchant,
  PaymentApp,
  Person,
  RewardRule,
  Transfer,
} from "@/db/schema";
import type {
  CardSummary,
  ExpenseRow,
  MonthSummary,
  PendingSummary,
  PersonBalance,
} from "@/server/queries";
import type { RewardOutcome, CapStatus } from "@/lib/rewards/engine";

async function request<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(url, {
    ...rest,
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body: json ? JSON.stringify(json) : rest.body,
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: string }
    | null;
  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(
      (payload && "error" in payload && payload.error) ||
        "That did not go through. Try again.",
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

export type RewardPreview = RewardOutcome & {
  rewardUnit: string;
  unitValuePaise: number;
  caps: CapStatus[];
};

export type TransferRow = Transfer & { personName: string; personColor: string };

/* ---------------------------------------------------------------- queries */

export const keys = {
  reference: ["reference"] as const,
  summary: (y: number, m: number) => ["summary", y, m] as const,
  expenses: (f: Record<string, unknown>) => ["expenses", f] as const,
  expense: (id: string) => ["expense", id] as const,
  instrument: (id: string, y: number) => ["instrument", id, y] as const,
  people: ["people"] as const,
  transfers: ["transfers"] as const,
  pending: ["pending"] as const,
};

export function useReference() {
  return useQuery({
    queryKey: keys.reference,
    queryFn: () => request<ReferenceData>("/api/reference"),
    staleTime: 60_000,
  });
}

export function useSummary(year: number, month: number) {
  return useQuery({
    queryKey: keys.summary(year, month),
    queryFn: () =>
      request<{ summary: MonthSummary; accountBalances: AccountBalance[] }>(
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
