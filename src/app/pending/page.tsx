"use client";

import * as React from "react";
import {
  CheckCheck,
  Hourglass,
  Plus,
  ReceiptIndianRupee,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { ExpenseRow } from "@/server/queries";
import {
  type StandaloneReimbursementRow,
  useCreateStandaloneReimbursement,
  useDeleteStandaloneReimbursement,
  usePending,
  useRecordReimbursement,
  useRecordStandaloneReimbursementReceipt,
  useUpdateStandaloneReimbursement,
  useUpdateRefund,
} from "@/lib/client-api";
import { formatMoney, toPaise } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/rewards/periods";
import { ExpenseSheet, useExpenseSheet } from "@/components/expenses/expense-sheet";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  Sheet,
  Spinner,
  Textarea,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { DataLoadError } from "@/components/ui/data-load-error";

export default function PendingPage() {
  const { data, error, isLoading, isFetching, refetch } = usePending();
  const sheet = useExpenseSheet();
  const [settling, setSettling] = React.useState<ExpenseRow | null>(null);
  const [claimEditor, setClaimEditor] = React.useState<{
    open: boolean;
    row: StandaloneReimbursementRow | null;
  }>({ open: false, row: null });
  const [receivingClaim, setReceivingClaim] =
    React.useState<StandaloneReimbursementRow | null>(null);

  const total =
    (data?.reimbursementOutstandingPaise ?? 0) +
    (data?.standaloneReimbursementOutstandingPaise ?? 0) +
    (data?.refundPendingPaise ?? 0) +
    (data?.lendingOutstandingPaise ?? 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
        <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">
          Money owed
        </h1>
        <p className="hint mt-0.5">
          Everything you are waiting to get back — reimbursements, refunds in flight
          and money you have lent.
        </p>
        </div>
        <Button
          variant="primary"
          className="w-full sm:w-auto"
          onClick={() => setClaimEditor({ open: true, row: null })}
        >
          <Plus className="size-4" />
          Add reimbursement
        </Button>
      </header>

      <div className="panel p-5">
        <p className="text-[0.8125rem] text-ink-2">Coming back to you</p>
        <p className="figure mt-1.5 text-[1.625rem] leading-none sm:text-[2rem]">
          {formatMoney(total)}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip tone="warn">
            {formatMoney(data?.reimbursementOutstandingPaise ?? 0)} reimbursements
          </Chip>
          <Chip tone="gain">
            {formatMoney(data?.standaloneReimbursementOutstandingPaise ?? 0)}
            {" "}company &amp; other
          </Chip>
          <Chip tone="accent">
            {formatMoney(data?.refundPendingPaise ?? 0)} refunds
          </Chip>
          <Chip tone="neutral">
            {formatMoney(data?.lendingOutstandingPaise ?? 0)} lent out
          </Chip>
        </div>
      </div>

      {error ? (
        <Panel>
          <DataLoadError
            title="Money owed could not be loaded"
            error={error}
            onRetry={refetch}
            isRetrying={isFetching}
          />
        </Panel>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-5" />
        </div>
      ) : (
        <>
          {(data?.standaloneReimbursements.length ?? 0) > 0 && (
            <StandaloneReimbursementsPanel
              rows={data?.standaloneReimbursements ?? []}
              onEdit={(row) => setClaimEditor({ open: true, row })}
              onRecord={setReceivingClaim}
            />
          )}

          <Panel
            title="Reimbursements"
            subtitle="Expenses you paid for that somebody else owes you"
            bodyClassName="p-0"
          >
            {!data || data.reimbursements.length === 0 ? (
              <EmptyState
                icon={<Hourglass className="size-5" />}
                title="Nothing outstanding"
                body="Mark an expense as reimbursable when you pay for something on someone else's behalf."
              />
            ) : (
              <ul className="divide-y divide-rule">
                {data.reimbursements.map((row) => {
                  const overdue =
                    row.expense.reimbursementDueDate &&
                    row.expense.reimbursementDueDate < todayISO();
                  return (
                    <li
                      key={row.expense.id}
                      className="row-hover flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => sheet.openEdit(row.expense.id)}
                          className="truncate text-left text-[0.875rem] font-medium hover:underline"
                        >
                          {row.expense.description ||
                            row.expense.merchantName ||
                            "Expense"}
                        </button>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-ink-3">
                          <span className="tnum">
                            {formatDate(row.expense.occurredAt)}
                          </span>
                          {row.expense.reimbursementFrom && (
                            <>
                              <span aria-hidden>·</span>
                              <span>from {row.expense.reimbursementFrom}</span>
                            </>
                          )}
                          {row.expense.reimbursementDueDate && (
                            <>
                              <span aria-hidden>·</span>
                              <span className={cn(overdue && "font-medium text-warn")}>
                                {overdue ? "was due" : "due"}{" "}
                                {formatDate(row.expense.reimbursementDueDate)}
                              </span>
                            </>
                          )}
                        </p>
                        {row.math.reimbursementReceivedPaise > 0 && (
                          <div className="mt-1.5 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-sunken">
                            <div
                              className="h-full rounded-full bg-gain"
                              style={{
                                width: `${(row.math.reimbursementReceivedPaise / Math.max(1, row.math.reimbursementExpectedPaise)) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-[0.9375rem] font-semibold text-warn tnum">
                          {formatMoney(row.math.reimbursementOutstandingPaise)}
                        </p>
                        <p className="text-[0.6875rem] text-ink-3 tnum">
                          of {formatMoney(row.math.reimbursementExpectedPaise)}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => setSettling(row)}
                      >
                        <CheckCheck className="size-3.5" />
                        Record payment
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Refunds in flight"
            subtitle="Raised but not yet back in your account"
            bodyClassName="p-0"
          >
            {!data || data.refunds.length === 0 ? (
              <EmptyState
                icon={<RotateCcw className="size-5" />}
                title="No refunds pending"
                body="File a refund on any expense and track it here until the money lands."
              />
            ) : (
              <ul className="divide-y divide-rule">
                {data.refunds.map((row) => (
                  <PendingRefundRow key={row.expense.id} row={row} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <SettleDialog row={settling} onClose={() => setSettling(null)} />
      <StandaloneReimbursementSheet
        open={claimEditor.open}
        row={claimEditor.row}
        onOpenChange={(open) =>
          setClaimEditor((current) => ({
            open,
            row: open ? current.row : null,
          }))
        }
      />
      <StandaloneReceiptDialog
        row={receivingClaim}
        onClose={() => setReceivingClaim(null)}
      />
      <ExpenseSheet
        open={sheet.open}
        onOpenChange={sheet.setOpen}
        expenseId={sheet.id}
      />
    </div>
  );
}

const reimbursementKindLabels: Record<
  StandaloneReimbursementRow["reimbursement"]["kind"],
  string
> = {
  fuel: "Fuel",
  travel: "Travel",
  meals: "Meals",
  phone_internet: "Phone & internet",
  medical: "Medical",
  allowance: "Allowance",
  other: "Other",
};

function StandaloneReimbursementsPanel({
  rows,
  onEdit,
  onRecord,
}: {
  rows: StandaloneReimbursementRow[];
  onEdit: (row: StandaloneReimbursementRow) => void;
  onRecord: (row: StandaloneReimbursementRow) => void;
}) {
  return (
    <Panel
      title="Company & other reimbursements"
      subtitle="Allowances and claims that are not tied to an expense you logged"
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-rule">
          {rows.map((row) => {
            const { reimbursement } = row;
            const overdue =
              row.outstandingPaise > 0 &&
              !!reimbursement.dueDate &&
              reimbursement.dueDate < todayISO();
            const progress = Math.min(
              100,
              (row.receivedPaise / Math.max(1, reimbursement.expectedPaise)) * 100,
            );

            return (
              <li key={reimbursement.id} className="row-hover px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-[220px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="min-w-0 truncate text-left text-[0.875rem] font-medium hover:underline"
                      >
                        {reimbursement.title}
                      </button>
                      <Chip tone="neutral">
                        {reimbursementKindLabels[reimbursement.kind]}
                      </Chip>
                      {row.status === "partial" ? (
                        <Chip tone="accent">Part paid</Chip>
                      ) : row.status === "settled" ? (
                        <Chip tone="gain">Received</Chip>
                      ) : row.status === "written_off" ? (
                        <Chip tone="neutral">Closed</Chip>
                      ) : overdue ? (
                        <Chip tone="alert">Overdue</Chip>
                      ) : (
                        <Chip tone="warn">Awaiting</Chip>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-ink-3">
                      <span>from {reimbursement.source}</span>
                      <span aria-hidden>·</span>
                      <span className="tnum">
                        submitted {formatDate(reimbursement.claimedAt)}
                      </span>
                      {reimbursement.dueDate && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={cn(overdue && "font-medium text-alert")}>
                            {overdue ? "was due" : "due"}{" "}
                            {formatDate(reimbursement.dueDate)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[0.9375rem] font-semibold text-warn tnum">
                      {formatMoney(row.outstandingPaise)}
                    </p>
                    <p className="text-[0.6875rem] text-ink-3 tnum">
                      of {formatMoney(reimbursement.expectedPaise)} left
                    </p>
                  </div>

                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 sm:flex-none"
                      onClick={() => onEdit(row)}
                    >
                      Edit
                    </Button>
                    {row.outstandingPaise > 0 && row.status !== "written_off" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 sm:flex-none"
                        onClick={() => onRecord(row)}
                      >
                        <CheckCheck className="size-3.5" />
                        Record payment
                      </Button>
                    )}
                  </div>
                </div>

                {row.receivedPaise > 0 && (
                  <div className="mt-2.5 max-w-[520px]">
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="h-full rounded-full bg-gain transition-[width]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <details className="group mt-2 text-[0.75rem] text-ink-2">
                      <summary className="w-fit cursor-pointer select-none font-medium text-ink-2 hover:text-ink">
                        {row.receipts.length} payment
                        {row.receipts.length === 1 ? "" : "s"} ·{" "}
                        {formatMoney(row.receivedPaise)} received
                      </summary>
                      <ul className="mt-2 space-y-1.5 border-l border-rule pl-3">
                        {row.receipts.map((receipt) => (
                          <li
                            key={receipt.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                          >
                            <span>
                              {formatDate(receipt.receivedAt)}
                              {receipt.note ? ` · ${receipt.note}` : ""}
                            </span>
                            <span className="font-medium text-gain tnum">
                              +{formatMoney(receipt.amountPaise)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    </Panel>
  );
}

function PendingRefundRow({ row }: { row: ExpenseRow }) {
  const updateRefund = useUpdateRefund();
  const pending = row.refunds.filter((r) => r.status === "pending");

  return (
    <li className="px-4 py-3">
      <p className="text-[0.875rem] font-medium">
        {row.expense.description || row.expense.merchantName || "Expense"}
      </p>
      <p className="mt-0.5 text-[0.75rem] text-ink-3 tnum">
        {formatDate(row.expense.occurredAt)} · original{" "}
        {formatMoney(row.expense.amountPaise)}
      </p>
      <ul className="mt-2 space-y-1.5">
        {pending.map((refund) => (
          <li key={refund.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <RotateCcw className="size-3.5 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">
              {refund.reason || "Refund raised"} · {formatDate(refund.refundedAt)}
            </span>
            <span className="shrink-0 text-[0.875rem] font-semibold tnum">
              {formatMoney(refund.amountPaise)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              loading={updateRefund.isPending}
              onClick={() =>
                updateRefund.mutate({ id: refund.id, status: "received" })
              }
            >
              Money is back
            </Button>
          </li>
        ))}
      </ul>
    </li>
  );
}

type StandaloneForm = {
  title: string;
  source: string;
  kind: StandaloneReimbursementRow["reimbursement"]["kind"];
  amount: string;
  claimedAt: string;
  dueDate: string;
  notes: string;
};

const blankStandaloneForm = (): StandaloneForm => ({
  title: "",
  source: "",
  kind: "other",
  amount: "",
  claimedAt: todayISO(),
  dueDate: "",
  notes: "",
});

function StandaloneReimbursementSheet({
  open,
  row,
  onOpenChange,
}: {
  open: boolean;
  row: StandaloneReimbursementRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const createReimbursement = useCreateStandaloneReimbursement();
  const updateReimbursement = useUpdateStandaloneReimbursement();
  const deleteReimbursement = useDeleteStandaloneReimbursement();
  const [form, setForm] = React.useState<StandaloneForm>(blankStandaloneForm);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (!row) {
      setForm(blankStandaloneForm());
    } else {
      const reimbursement = row.reimbursement;
      setForm({
        title: reimbursement.title,
        source: reimbursement.source,
        kind: reimbursement.kind,
        amount: String(reimbursement.expectedPaise / 100),
        claimedAt: reimbursement.claimedAt,
        dueDate: reimbursement.dueDate ?? "",
        notes: reimbursement.notes,
      });
    }
    setConfirmDelete(false);
  }, [open, row]);

  function set<K extends keyof StandaloneForm>(key: K, value: StandaloneForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const amountPaise = toPaise(form.amount);
  const amountBelowReceived = !!row && amountPaise < row.receivedPaise;
  const canSave =
    !!form.title.trim() &&
    !!form.source.trim() &&
    !!form.claimedAt &&
    amountPaise > 0 &&
    !amountBelowReceived;
  const saving = createReimbursement.isPending || updateReimbursement.isPending;

  function save() {
    if (!canSave) return;
    const payload = {
      title: form.title.trim(),
      source: form.source.trim(),
      kind: form.kind,
      expectedPaise: amountPaise,
      claimedAt: form.claimedAt,
      dueDate: form.dueDate || null,
      notes: form.notes.trim(),
    };
    const options = { onSuccess: () => onOpenChange(false) };
    if (row) {
      updateReimbursement.mutate(
        { id: row.reimbursement.id, ...payload },
        options,
      );
    } else {
      createReimbursement.mutate(payload, options);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        width="520px"
        title={row ? "Edit reimbursement" : "Add a reimbursement"}
        description="Track money due to you that is not linked to a LedgerKit expense."
        footer={
          <>
            {row && (
              <Button
                variant="danger"
                className="order-last basis-full sm:order-none sm:mr-auto sm:basis-auto"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!canSave}
              onClick={save}
            >
              {row ? "Save changes" : "Add reimbursement"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="What is it for?" required>
            <Input
              autoFocus
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Fuel allowance for September"
              maxLength={120}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Who will pay you?" required>
              <Input
                value={form.source}
                onChange={(event) => set("source", event.target.value)}
                placeholder="Company or organisation"
                maxLength={160}
              />
            </Field>
            <Field label="Type">
              <Select
                value={form.kind}
                onChange={(event) =>
                  set("kind", event.target.value as StandaloneForm["kind"])
                }
              >
                {Object.entries(reimbursementKindLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Amount expected"
            required
            error={
              amountBelowReceived
                ? `At least ${formatMoney(row?.receivedPaise ?? 0)} has already been received`
                : undefined
            }
          >
            <Input
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => set("amount", event.target.value)}
              placeholder="0.00"
              className="tnum"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Submitted on" required>
              <Input
                type="date"
                value={form.claimedAt}
                onChange={(event) => set("claimedAt", event.target.value)}
              />
            </Field>
            <Field label="Expected by" hint="Optional">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) => set("dueDate", event.target.value)}
              />
            </Field>
          </div>

          {row && row.receivedPaise > 0 && (
            <div className="rounded-[10px] border border-rule bg-paper px-3 py-2.5 text-[0.8125rem] text-ink-2">
              <span className="font-medium text-gain tnum">
                {formatMoney(row.receivedPaise)} received
              </span>
              {" · "}
              Changing the expected amount will not alter payment history.
            </div>
          )}

          <Field label="Notes" hint="Optional claim number or anything to follow up on">
            <Textarea
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="Claim reference, contact person, or reminder"
              maxLength={500}
            />
          </Field>
        </div>
      </Sheet>

      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this reimbursement?"
        description="The reimbursement and its payment history will be permanently removed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={deleteReimbursement.isPending}
              onClick={() => {
                if (!row) return;
                deleteReimbursement.mutate(row.reimbursement.id, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    onOpenChange(false);
                  },
                });
              }}
            >
              Delete reimbursement
            </Button>
          </>
        }
      />
    </>
  );
}

function StandaloneReceiptDialog({
  row,
  onClose,
}: {
  row: StandaloneReimbursementRow | null;
  onClose: () => void;
}) {
  const recordReceipt = useRecordStandaloneReimbursementReceipt();
  const [amount, setAmount] = React.useState("");
  const [receivedAt, setReceivedAt] = React.useState(todayISO());
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!row) return;
    setAmount(String(row.outstandingPaise / 100));
    setReceivedAt(todayISO());
    setNote("");
  }, [row]);

  if (!row) return null;

  const amountPaise = toPaise(amount);
  const tooMuch = amountPaise > row.outstandingPaise;
  const remainingPaise = Math.max(0, row.outstandingPaise - amountPaise);

  return (
    <Dialog
      open={!!row}
      onOpenChange={(open) => !open && onClose()}
      title="Record reimbursement payment"
      description={`${formatMoney(row.outstandingPaise)} is still due from ${row.reimbursement.source}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={recordReceipt.isPending}
            disabled={amountPaise <= 0 || tooMuch || !receivedAt}
            onClick={() =>
              recordReceipt.mutate(
                {
                  id: row.reimbursement.id,
                  amountPaise,
                  receivedAt,
                  note: note.trim(),
                },
                { onSuccess: onClose },
              )
            }
          >
            {remainingPaise === 0 ? "Mark fully received" : "Record payment"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-[10px] border border-rule bg-paper px-3 py-2.5">
          <ReceiptIndianRupee className="mt-0.5 size-4 shrink-0 text-gain" />
          <div className="min-w-0 text-[0.8125rem] text-ink-2">
            <p className="font-medium text-ink">{row.reimbursement.title}</p>
            <p className="mt-0.5 tnum">
              {formatMoney(row.receivedPaise)} of{" "}
              {formatMoney(row.reimbursement.expectedPaise)} received so far
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Amount received"
            required
            error={
              tooMuch
                ? `No more than ${formatMoney(row.outstandingPaise)} is outstanding`
                : undefined
            }
            hint={
              !tooMuch && amountPaise > 0 && remainingPaise > 0
                ? `${formatMoney(remainingPaise)} will remain outstanding`
                : undefined
            }
          >
            <Input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="tnum"
              placeholder="0.00"
            />
          </Field>
          <Field label="Received on" required>
            <Input
              type="date"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Note" hint="Optional reference or payment details">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Bank reference, payroll note…"
            maxLength={300}
          />
        </Field>
      </div>
    </Dialog>
  );
}

function SettleDialog({
  row,
  onClose,
}: {
  row: ExpenseRow | null;
  onClose: () => void;
}) {
  const recordReimbursement = useRecordReimbursement();
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (row) setAmount(String(row.math.reimbursementOutstandingPaise / 100));
  }, [row]);

  if (!row) return null;

  return (
    <Dialog
      open={!!row}
      onOpenChange={(v) => !v && onClose()}
      title="Record a payment"
      description={`${formatMoney(row.math.reimbursementOutstandingPaise)} is still outstanding on this expense.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={recordReimbursement.isPending}
            disabled={toPaise(amount) <= 0}
            onClick={() => {
              recordReimbursement.mutate(
                {
                  id: row.expense.id,
                  action: "record",
                  amountPaise: toPaise(amount),
                },
                { onSuccess: onClose },
              );
            }}
          >
            Record
          </Button>
        </>
      }
    >
      <Field label="How much came back">
        <Input
          autoFocus
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tnum"
        />
      </Field>
      <p className="hint mt-2">
        Record a smaller number if only part of it has been settled — the rest stays
        on this list.
      </p>
    </Dialog>
  );
}
