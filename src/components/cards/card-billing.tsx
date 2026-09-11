"use client";

import * as React from "react";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Landmark,
  Pencil,
  ReceiptIndianRupee,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { CardPayment } from "@/db/schema";
import {
  type CardBillingRow,
  useCardBilling,
  useCreateCardPayment,
  useDeleteCardPayment,
  useReference,
  useUpdateCardBilling,
  useUpdateCardPayment,
} from "@/lib/client-api";
import { formatMoney, toPaise } from "@/lib/money";
import { formatDate, formatDateShort, todayISO } from "@/lib/rewards/periods";
import { cn } from "@/lib/utils";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  Spinner,
} from "@/components/ui/primitives";

export function CardBillingDashboard({
  instrumentId,
  compact = false,
}: {
  instrumentId?: string;
  compact?: boolean;
}) {
  const { data, error, isLoading, isFetching, refetch } = useCardBilling();
  const { data: reference } = useReference();
  const [configuring, setConfiguring] = React.useState<CardBillingRow | null>(null);
  const [paying, setPaying] = React.useState<CardBillingRow | null>(null);
  const [editingPayment, setEditingPayment] = React.useState<CardPayment | null>(null);
  const rows = (data ?? []).filter(
    (row) => !instrumentId || row.instrument.id === instrumentId,
  );

  if (error) {
    return (
      <Panel>
        <EmptyState
          icon={<TriangleAlert className="size-5" />}
          title="Card bills could not be loaded"
          body={error.message}
          action={
            <Button variant="secondary" loading={isFetching} onClick={() => void refetch()}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
          }
        />
      </Panel>
    );
  }

  if (isLoading || !data) {
    return (
      <Panel>
        <div className="flex items-center justify-center gap-2 py-10 text-[0.8125rem] text-ink-2">
          <Spinner /> Loading card cycles…
        </div>
      </Panel>
    );
  }

  if (!rows.length) return null;

  const totalOutstanding = rows.reduce(
    (sum, row) => sum + Math.max(0, row.summary.currentOutstandingPaise),
    0,
  );
  const totalDue = rows.reduce((sum, row) => sum + row.summary.amountDuePaise, 0);
  const totalUnbilled = rows.reduce(
    (sum, row) => sum + Math.max(0, row.summary.unbilledPaise),
    0,
  );
  const needsSetup = rows.filter((row) => !row.summary.configured).length;

  return (
    <>
      <Panel
        title={instrumentId ? "Billing cycle" : "Bills & cash flow"}
        subtitle="Purchases stay expenses; repayments reduce card liability and bank cash without being counted twice."
        action={
          instrumentId && rows[0] ? (
            <Button size="sm" variant="secondary" onClick={() => setConfiguring(rows[0])}>
              <CalendarClock className="size-3.5" />
              {rows[0].summary.configured ? "Edit cycle" : "Set up cycle"}
            </Button>
          ) : undefined
        }
        bodyClassName="p-0"
      >
        {!instrumentId && (
          <div className="grid border-b border-rule sm:grid-cols-3">
            <Metric label="Tracked outstanding" value={formatMoney(totalOutstanding)} />
            <Metric label="Billed and due" value={formatMoney(totalDue)} tone={totalDue > 0 ? "warn" : "gain"} />
            <Metric label="Unbilled" value={formatMoney(totalUnbilled)} />
          </div>
        )}

        {needsSetup > 0 && !instrumentId && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-warn-soft px-4 py-3">
            <div className="flex items-center gap-2 text-[0.8125rem] text-warn">
              <CalendarClock className="size-4" />
              Set a bill date for {needsSetup} {needsSetup === 1 ? "card" : "cards"} to separate billed and unbilled spend.
            </div>
          </div>
        )}

        <div className={cn("divide-y divide-rule", compact && "max-h-[520px] overflow-y-auto")}>
          {rows.map((row) => (
            <BillingCard
              key={row.instrument.id}
              row={row}
              detailed={Boolean(instrumentId)}
              accountName={
                reference?.accounts.find(
                  (account) => account.id === row.selection.repaymentAccountId,
                )?.name
              }
              onConfigure={() => setConfiguring(row)}
              onPay={() => {
                setEditingPayment(null);
                setPaying(row);
              }}
              onEditPayment={(payment) => {
                setEditingPayment(payment);
                setPaying(row);
              }}
            />
          ))}
        </div>
      </Panel>

      <BillingConfigDialog
        row={configuring}
        accounts={reference?.accounts ?? []}
        onClose={() => setConfiguring(null)}
      />
      <PaymentDialog
        row={paying}
        payment={editingPayment}
        accounts={reference?.accounts ?? []}
        onClose={() => {
          setPaying(null);
          setEditingPayment(null);
        }}
      />
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "gain" | "warn" }) {
  return (
    <div className="border-rule px-4 py-4 sm:not-last:border-r">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.07em] text-ink-3">{label}</p>
      <p className={cn("figure mt-1 text-[1.375rem]", tone === "gain" && "text-gain", tone === "warn" && "text-warn")}>
        {value}
      </p>
    </div>
  );
}

function BillingCard({
  row,
  detailed,
  accountName,
  onConfigure,
  onPay,
  onEditPayment,
}: {
  row: CardBillingRow;
  detailed: boolean;
  accountName?: string;
  onConfigure: () => void;
  onPay: () => void;
  onEditPayment: (payment: CardPayment) => void;
}) {
  const { instrument, selection, summary, payments } = row;
  const deletePayment = useDeleteCardPayment();
  return (
    <article className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-16 shrink-0 items-end rounded-[8px] p-1.5 text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${instrument.colorFrom}, ${instrument.colorTo})` }}
          >
            <CreditCard className="size-3.5 text-white/80" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.875rem] font-semibold">{instrument.shortName}</p>
            {summary.configured ? (
              <p className="mt-0.5 text-[0.75rem] text-ink-3">
                Statement on day {selection.statementDay} · due about {selection.dueOffsetDays} days later
              </p>
            ) : (
              <p className="mt-0.5 text-[0.75rem] text-warn">Billing cycle not configured</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!detailed && (
            <Button size="sm" variant="ghost" onClick={onConfigure}>
              {summary.configured ? "Edit cycle" : "Set cycle"}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onPay}>
            <ReceiptIndianRupee className="size-3.5" />
            Record payment
          </Button>
        </div>
      </div>

      {summary.configured ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <CycleFigure label="Tracked outstanding" value={formatMoney(summary.currentOutstandingPaise)} />
          <CycleFigure
            label={summary.status === "overdue" ? "Overdue" : "Amount due"}
            value={formatMoney(summary.amountDuePaise)}
            tone={summary.status === "overdue" ? "alert" : summary.amountDuePaise ? "warn" : "gain"}
            detail={summary.dueDate ? `by ${formatDateShort(summary.dueDate)}` : undefined}
          />
          <CycleFigure label="Unbilled" value={formatMoney(summary.unbilledPaise)} detail={summary.nextStatementDate ? `next bill ${formatDateShort(summary.nextStatementDate)}` : undefined} />
          <CycleFigure label="Paid this month" value={formatMoney(summary.paidThisMonthPaise)} detail={accountName ? `from ${accountName}` : undefined} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onConfigure}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-[11px] border border-dashed border-rule-strong bg-paper px-4 py-3 text-left transition-colors hover:bg-sunken/50"
        >
          <span>
            <span className="block text-[0.8125rem] font-semibold">Add your statement date</span>
            <span className="mt-0.5 block text-[0.75rem] text-ink-3">LedgerKit will then separate billed spend, unbilled spend and repayments.</span>
          </span>
          <CalendarClock className="size-4 shrink-0 text-ink-3" />
        </button>
      )}

      {detailed && summary.configured && (
        <div className="mt-4 rounded-[11px] border border-rule bg-paper p-3">
          <div className="flex items-center justify-between gap-3 text-[0.75rem]">
            <span className="font-medium">Latest estimated statement</span>
            <Chip tone={summary.status === "paid" ? "gain" : summary.status === "overdue" ? "alert" : "warn"}>
              {summary.status === "paid" ? "paid" : summary.status}
            </Chip>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[0.75rem] text-ink-2">
            <span>{summary.cycleStart && formatDateShort(summary.cycleStart)}</span>
            <span className="h-px flex-1 bg-rule-strong" />
            <span>{summary.statementDate && formatDateShort(summary.statementDate)}</span>
            <span className="h-px flex-1 bg-rule-strong" />
            <span>{summary.dueDate && formatDateShort(summary.dueDate)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[0.625rem] uppercase tracking-[0.05em] text-ink-3">
            <span>cycle starts</span><span>statement</span><span>payment due</span>
          </div>
        </div>
      )}

      {detailed && payments.length > 0 && (
        <div className="mt-4 border-t border-rule pt-3">
          <p className="text-[0.75rem] font-semibold">Payment history</p>
          <ul className="mt-2 divide-y divide-rule">
            {payments.slice(0, 8).map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium">{formatMoney(payment.amountPaise)}</p>
                  <p className="truncate text-[0.6875rem] text-ink-3">{formatDate(payment.paidAt)}{payment.note ? ` · ${payment.note}` : ""}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Edit card payment" onClick={() => onEditPayment(payment)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Delete card payment" loading={deletePayment.isPending && deletePayment.variables === payment.id} onClick={() => deletePayment.mutate(payment.id)}>
                    <Trash2 className="size-3.5 text-alert" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function CycleFigure({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "gain" | "warn" | "alert" }) {
  return (
    <div className="rounded-[10px] bg-sunken px-3 py-2.5">
      <p className="text-[0.6875rem] text-ink-3">{label}</p>
      <p className={cn("figure mt-0.5 text-[1rem]", tone === "gain" && "text-gain", tone === "warn" && "text-warn", tone === "alert" && "text-alert")}>{value}</p>
      {detail && <p className="mt-0.5 truncate text-[0.625rem] text-ink-3">{detail}</p>}
    </div>
  );
}

function BillingConfigDialog({ row, accounts, onClose }: { row: CardBillingRow | null; accounts: { id: string; name: string; bank: string }[]; onClose: () => void }) {
  const update = useUpdateCardBilling();
  const [statementDay, setStatementDay] = React.useState("25");
  const [dueOffset, setDueOffset] = React.useState("20");
  const [accountId, setAccountId] = React.useState("");
  const [opening, setOpening] = React.useState("0");
  const [openingDate, setOpeningDate] = React.useState(todayISO());
  const [autopayMode, setAutopayMode] = React.useState("none");
  const [autopayAmount, setAutopayAmount] = React.useState("");

  React.useEffect(() => {
    if (!row) return;
    setStatementDay(String(row.selection.statementDay ?? 25));
    setDueOffset(String(row.selection.dueOffsetDays ?? 20));
    setAccountId(row.selection.repaymentAccountId ?? "");
    setOpening(String(row.selection.openingOutstandingPaise / 100));
    setOpeningDate(row.selection.openingDate ?? todayISO());
    setAutopayMode(row.selection.autopayMode);
    setAutopayAmount(String(row.selection.autopayAmountPaise / 100 || ""));
    update.reset();
  }, [row]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!row) return;
    await update.mutateAsync({
      id: row.instrument.id,
      statementDay: Number(statementDay),
      dueOffsetDays: Number(dueOffset),
      repaymentAccountId: accountId || null,
      openingOutstandingPaise: toPaise(opening || "0"),
      openingDate,
      autopayMode,
      autopayAmountPaise: autopayMode === "fixed" ? toPaise(autopayAmount || "0") : 0,
    });
    onClose();
  }

  return (
    <Dialog
      open={Boolean(row)}
      onOpenChange={(open) => !open && onClose()}
      title={`Billing cycle${row ? ` · ${row.instrument.shortName}` : ""}`}
      description="Use the dates shown on your actual statement. LedgerKit estimates cycles and keeps repayments separate from expenses."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={update.isPending} onClick={() => void save()}>Save cycle</Button></>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Statement generated on" hint="For 29–31, shorter months use their final day.">
            <Input type="number" min={1} max={31} value={statementDay} onChange={(event) => setStatementDay(event.target.value)} />
          </Field>
          <Field label="Usually due after" hint="Days after statement generation.">
            <div className="relative"><Input type="number" min={1} max={45} value={dueOffset} onChange={(event) => setDueOffset(event.target.value)} className="pr-14" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">days</span></div>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Track from" hint="Transactions before this date are represented by the opening outstanding.">
            <Input type="date" value={openingDate} onChange={(event) => setOpeningDate(event.target.value)} />
          </Field>
          <Field label="Outstanding on that date" hint="Enter zero if the card had no unpaid balance.">
            <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">₹</span><Input inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} className="pl-7" /></div>
          </Field>
        </div>
        <Field label="Default repayment account">
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">External or choose each time</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.bank ? ` · ${account.bank}` : ""}</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Autopay preference" hint="For reminders only; LedgerKit never initiates payments.">
            <Select value={autopayMode} onChange={(event) => setAutopayMode(event.target.value)}>
              <option value="none">No autopay</option><option value="full">Full statement balance</option><option value="minimum">Minimum due</option><option value="fixed">Fixed amount</option>
            </Select>
          </Field>
          {autopayMode === "fixed" && <Field label="Fixed amount"><Input inputMode="decimal" value={autopayAmount} onChange={(event) => setAutopayAmount(event.target.value)} placeholder="0.00" /></Field>}
        </div>
        <div className="flex gap-2 rounded-[10px] border border-accent/15 bg-accent-soft px-3 py-2.5 text-[0.75rem] text-ink-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
          Card purchases remain dated when they happened. A repayment only moves cash from your bank to this card.
        </div>
      </div>
    </Dialog>
  );
}

function PaymentDialog({ row, payment, accounts, onClose }: { row: CardBillingRow | null; payment: CardPayment | null; accounts: { id: string; name: string; bank: string }[]; onClose: () => void }) {
  const create = useCreateCardPayment();
  const update = useUpdateCardPayment();
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(todayISO());
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!row) return;
    setAmount(String((payment?.amountPaise ?? (row.summary.configured ? row.summary.amountDuePaise || row.summary.currentOutstandingPaise : 0)) / 100 || ""));
    setAccountId(payment?.accountId ?? row.selection.repaymentAccountId ?? "");
    setPaidAt(payment?.paidAt ?? todayISO());
    setNote(payment?.note ?? "");
    create.reset(); update.reset();
  }, [row, payment]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!row) return;
    const payload = { accountId: accountId || null, amountPaise: toPaise(amount || "0"), paidAt, note: note.trim() };
    if (payment) await update.mutateAsync({ id: payment.id, ...payload });
    else await create.mutateAsync({ instrumentId: row.instrument.id, ...payload });
    onClose();
  }

  return (
    <Dialog
      open={Boolean(row)} onOpenChange={(open) => !open && onClose()}
      title={payment ? "Edit card payment" : "Record card payment"}
      description={row ? `${row.instrument.shortName} · this is a transfer, not another expense.` : ""}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={toPaise(amount || "0") <= 0} loading={create.isPending || update.isPending} onClick={() => void save()}>{payment ? "Save payment" : "Record payment"}</Button></>}
    >
      <div className="space-y-4">
        {row && !payment && (
          <div className="flex flex-wrap gap-2">
            {row.summary.amountDuePaise > 0 && <Button size="sm" variant="secondary" onClick={() => setAmount(String(row.summary.amountDuePaise / 100))}>Full due · {formatMoney(row.summary.amountDuePaise)}</Button>}
            {row.summary.configured && row.summary.currentOutstandingPaise > 0 && <Button size="sm" variant="secondary" onClick={() => setAmount(String(row.summary.currentOutstandingPaise / 100))}>Outstanding · {formatMoney(row.summary.currentOutstandingPaise)}</Button>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount paid" required><Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus /></Field>
          <Field label="Payment date" required><Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></Field>
        </div>
        <Field label="Paid from"><Select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">External account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.bank ? ` · ${account.bank}` : ""}</option>)}</Select></Field>
        <Field label="Note"><Input maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional reference or confirmation number" /></Field>
        {accountId ? <p className="flex items-center gap-2 text-[0.75rem] text-ink-2"><Landmark className="size-3.5" />This payment will reduce the selected bank account balance.</p> : <p className="text-[0.75rem] text-ink-3">External payments reduce the card balance without changing a LedgerKit bank account.</p>}
      </div>
    </Dialog>
  );
}
