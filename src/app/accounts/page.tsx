"use client";

import * as React from "react";
import { Landmark, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import type { AccountBalance } from "@/lib/client-api";
import {
  useCreateAccount,
  useDeleteAccount,
  useReference,
  useUpdateAccount,
} from "@/lib/client-api";
import { formatMoney, toPaise } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/rewards/periods";
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
import { cn } from "@/lib/utils";

export default function AccountsPage() {
  const { data: reference, isLoading } = useReference();
  const [editing, setEditing] = React.useState<AccountBalance | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const balances = reference?.accountBalances ?? [];
  const total = balances
    .filter((b) => b.account.includeInTotals)
    .reduce((s, b) => s + b.balancePaise, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">
            Accounts
          </h1>
          <p className="hint mt-0.5">
            Set an opening balance and LedgerKit keeps the running figure from
            everything you log against it.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          Add account
        </Button>
      </header>

      <div className="panel p-5">
        <p className="text-[0.8125rem] text-ink-2">Money on hand</p>
        <p className="figure mt-1.5 text-[1.625rem] leading-none sm:text-[2rem]">
          {formatMoney(total)}
        </p>
        <p className="mt-2 text-[0.75rem] text-ink-3">
          Across {balances.filter((b) => b.account.includeInTotals).length} accounts.
          Credit card balances are not counted here.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner className="size-5" />
        </div>
      ) : balances.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Landmark className="size-5" />}
            title="No accounts yet"
            body="Add the accounts you pay from so UPI spending has somewhere to land."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {balances.map((row) => (
            <article key={row.account.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-[9px]"
                    style={{ background: `${row.account.colorHex}1a` }}
                  >
                    {row.account.kind === "cash" ? (
                      <Wallet className="size-4" style={{ color: row.account.colorHex }} />
                    ) : (
                      <Landmark className="size-4" style={{ color: row.account.colorHex }} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-medium">
                      {row.account.name}
                    </p>
                    <p className="text-[0.75rem] text-ink-3">
                      {row.account.bank || row.account.kind}
                      {row.account.last4 && ` ····${row.account.last4}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${row.account.name}`}
                    onClick={() => {
                      setEditing(row);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              </div>

              <p
                className={cn(
                  "figure mt-3 text-[1.5rem] leading-none",
                  row.balancePaise < 0 && "text-alert",
                )}
              >
                {formatMoney(row.balancePaise)}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-rule pt-3 text-[0.75rem]">
                <Row label="Opening" value={formatMoney(row.account.openingBalancePaise)} />
                <Row label="Spent" value={`−${formatMoney(row.spentPaise)}`} />
                <Row label="Refunds in" value={`+${formatMoney(row.refundedPaise)}`} />
                <Row label="Sent to people" value={`−${formatMoney(row.sentPaise)}`} />
                <Row label="Received" value={`+${formatMoney(row.receivedPaise)}`} />
                <Row label="Since" value={formatDate(row.account.openingDate)} />
              </dl>

              {!row.account.includeInTotals && (
                <Chip tone="neutral" className="mt-3">
                  Excluded from the total above
                </Chip>
              )}
            </article>
          ))}
        </div>
      )}

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-medium tnum">{value}</dd>
    </div>
  );
}

function AccountDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: AccountBalance | null;
}) {
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [name, setName] = React.useState("");
  const [bank, setBank] = React.useState("");
  const [kind, setKind] = React.useState("savings");
  const [last4, setLast4] = React.useState("");
  const [balance, setBalance] = React.useState("");
  const [openingDate, setOpeningDate] = React.useState(todayISO());
  const [colorHex, setColorHex] = React.useState("#4B5563");

  React.useEffect(() => {
    if (!open) return;
    setName(account?.account.name ?? "");
    setBank(account?.account.bank ?? "");
    setKind(account?.account.kind ?? "savings");
    setLast4(account?.account.last4 ?? "");
    setBalance(
      account ? String(account.account.openingBalancePaise / 100) : "",
    );
    setOpeningDate(account?.account.openingDate ?? todayISO());
    setColorHex(account?.account.colorHex ?? "#4B5563");
  }, [open, account]);

  function save() {
    const payload = {
      name: name.trim() || "Account",
      bank: bank.trim(),
      kind,
      last4: last4.trim(),
      openingBalancePaise: toPaise(balance || "0"),
      openingDate,
      colorHex,
    };
    if (account) updateAccount.mutate({ id: account.account.id, ...payload });
    else createAccount.mutate(payload);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? "Edit account" : "Add an account"}
      description="The opening balance is your starting point — everything logged after the date below adjusts it."
      footer={
        <>
          {account && (
            <Button
              variant="danger"
              className="order-last basis-full sm:order-none sm:mr-auto sm:basis-auto"
              onClick={() => {
                deleteAccount.mutate(account.account.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {account ? "Save" : "Add account"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="HDFC Bank savings"
            />
          </Field>
          <Field label="Bank">
            <Input value={bank} onChange={(e) => setBank(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="savings">Savings</option>
              <option value="current">Current</option>
              <option value="wallet">Wallet</option>
              <option value="cash">Cash</option>
            </Select>
          </Field>
          <Field label="Last 4">
            <Input
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              maxLength={4}
              className="tnum"
            />
          </Field>
          <Field label="Colour">
            <Input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              className="h-[38px] p-1"
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Balance">
            <Input
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="tnum"
              placeholder="0.00"
            />
          </Field>
          <Field label="As of" hint="Activity after this adjusts the balance">
            <Input
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
