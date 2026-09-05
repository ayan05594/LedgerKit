"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { PersonBalance } from "@/server/queries";
import {
  useCreatePerson,
  useCreateTransfer,
  useDeleteTransfer,
  usePeople,
  useReference,
  useTransfers,
} from "@/lib/client-api";
import { formatMoney, toPaise } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/rewards/periods";
import { initials } from "@/lib/utils";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  Spinner,
  Switch,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { DataLoadError } from "@/components/ui/data-load-error";

export default function PeoplePage() {
  const {
    data: balances,
    error,
    isLoading,
    isFetching,
    refetch,
  } = usePeople();
  const {
    data: transfers,
    error: transfersError,
    isLoading: transfersLoading,
    isFetching: transfersFetching,
    refetch: refetchTransfers,
  } = useTransfers();
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [personOpen, setPersonOpen] = React.useState(false);
  const [prefillPerson, setPrefillPerson] = React.useState<string | null>(null);

  const owedToYou = (balances ?? [])
    .filter((b) => b.netPaise > 0)
    .reduce((s, b) => s + b.netPaise, 0);
  const youOwe = (balances ?? [])
    .filter((b) => b.netPaise < 0)
    .reduce((s, b) => s + Math.abs(b.netPaise), 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">
            People
          </h1>
          <p className="hint mt-0.5">
            Money sent to and received from friends, family and anyone else. Gifts
            and your share of a split count as spending; loans do not.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPersonOpen(true)}>
            <UserPlus className="size-3.5" />
            Add person
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setPrefillPerson(null);
              setTransferOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Record transfer
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="panel p-4">
          <p className="text-[0.8125rem] text-ink-2">Owed to you</p>
          <p className="figure mt-1.5 text-[1.625rem] leading-none text-gain">
            {formatMoney(owedToYou)}
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-[0.8125rem] text-ink-2">You owe</p>
          <p className="figure mt-1.5 text-[1.625rem] leading-none text-warn">
            {formatMoney(youOwe)}
          </p>
        </div>
      </div>

      {error ? (
        <Panel>
          <DataLoadError
            title="People could not be loaded"
            error={error}
            onRetry={refetch}
            isRetrying={isFetching}
          />
        </Panel>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-5" />
        </div>
      ) : !balances || balances.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Users className="size-5" />}
            title="Nobody added yet"
            body="Add the people you split bills and lend money to."
            action={
              <Button variant="primary" onClick={() => setPersonOpen(true)}>
                Add someone
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {balances.map((b) => (
            <PersonCard
              key={b.person.id}
              balance={b}
              onSettle={() => {
                setPrefillPerson(b.person.id);
                setTransferOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <Panel title="Transfer log" bodyClassName="p-0">
        {transfersError ? (
          <DataLoadError
            title="Transfers could not be loaded"
            error={transfersError}
            onRetry={refetchTransfers}
            isRetrying={transfersFetching}
          />
        ) : transfersLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-5" />
          </div>
        ) : !transfers || transfers.length === 0 ? (
          <EmptyState
            icon={<ArrowUpRight className="size-5" />}
            title="No transfers recorded"
            body="Record money you send or receive and it will show up here."
          />
        ) : (
          <ul className="divide-y divide-rule">
            {transfers.map((t) => (
              <TransferRow key={t.id} transfer={t} />
            ))}
          </ul>
        )}
      </Panel>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        prefillPersonId={prefillPerson}
      />
      <PersonDialog open={personOpen} onOpenChange={setPersonOpen} />
    </div>
  );
}

function PersonCard({
  balance,
  onSettle,
}: {
  balance: PersonBalance;
  onSettle: () => void;
}) {
  const { person, netPaise, sentPaise, receivedPaise, transferCount, lastActivity } =
    balance;
  const owesYou = netPaise > 0;
  const youOwe = netPaise < 0;

  return (
    <article className="panel p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-semibold text-white"
          style={{ background: person.colorHex }}
        >
          {initials(person.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-medium">{person.name}</p>
          <p className="text-[0.75rem] capitalize text-ink-3">{person.relation}</p>
        </div>
      </div>

      <p
        className={cn(
          "figure mt-3 text-[1.375rem] leading-none",
          owesYou && "text-gain",
          youOwe && "text-warn",
          netPaise === 0 && "text-ink-3",
        )}
      >
        {netPaise === 0 ? "Settled up" : formatMoney(Math.abs(netPaise))}
      </p>
      {netPaise !== 0 && (
        <p className="mt-1 text-[0.75rem] text-ink-2">
          {owesYou ? `${person.name} owes you` : `you owe ${person.name}`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-rule pt-3">
        <Chip tone="neutral">
          <ArrowUpRight className="size-3" />
          {formatMoney(sentPaise)} sent
        </Chip>
        <Chip tone="neutral">
          <ArrowDownLeft className="size-3" />
          {formatMoney(receivedPaise)} in
        </Chip>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] text-ink-3">
          {transferCount} transfers
          {lastActivity && ` · last ${formatDate(lastActivity)}`}
        </span>
        <Button size="sm" variant="secondary" onClick={onSettle}>
          Record
        </Button>
      </div>
    </article>
  );
}

function TransferRow({
  transfer,
}: {
  transfer: {
    id: string;
    direction: "sent" | "received";
    amountPaise: number;
    occurredAt: string;
    purpose: string;
    countsAsSpend: boolean;
    note: string;
    personName: string;
    personColor: string;
  };
}) {
  const deleteTransfer = useDeleteTransfer();
  const sent = transfer.direction === "sent";

  return (
    <li className="row-hover flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[9px]",
          sent ? "bg-warn-soft text-warn" : "bg-gain-soft text-gain",
        )}
      >
        {sent ? (
          <ArrowUpRight className="size-4" />
        ) : (
          <ArrowDownLeft className="size-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.875rem] font-medium">
          {sent ? "Sent to" : "Received from"} {transfer.personName}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-ink-3">
          <span className="tnum">{formatDate(transfer.occurredAt)}</span>
          <span aria-hidden>·</span>
          <span className="capitalize">{transfer.purpose}</span>
          {transfer.note && (
            <>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="hidden truncate sm:inline">{transfer.note}</span>
            </>
          )}
        </p>
        {transfer.countsAsSpend && (
          <Chip tone="neutral" className="mt-1 sm:hidden">
            counts as spend
          </Chip>
        )}
      </div>

      {transfer.countsAsSpend && (
        <Chip tone="neutral" className="hidden sm:inline-flex">
          counts as spend
        </Chip>
      )}
      <span
        className={cn(
          "shrink-0 text-[0.875rem] font-semibold tnum sm:text-[0.9375rem]",
          sent ? "text-ink" : "text-gain",
        )}
      >
        {sent ? "−" : "+"}
        {formatMoney(transfer.amountPaise)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Remove transfer"
        onClick={() => deleteTransfer.mutate(transfer.id)}
      >
        <Trash2 className="size-3.5 text-alert" />
      </Button>
    </li>
  );
}

function TransferDialog({
  open,
  onOpenChange,
  prefillPersonId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefillPersonId: string | null;
}) {
  const { data: reference } = useReference();
  const createTransfer = useCreateTransfer();

  const [direction, setDirection] = React.useState<"sent" | "received">("sent");
  const [personId, setPersonId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [occurredAt, setOccurredAt] = React.useState(todayISO());
  const [accountId, setAccountId] = React.useState("");
  const [appSlug, setAppSlug] = React.useState("");
  const [purpose, setPurpose] = React.useState("other");
  const [countsAsSpend, setCountsAsSpend] = React.useState(false);
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setDirection("sent");
    setPersonId(prefillPersonId ?? reference?.people[0]?.id ?? "");
    setAmount("");
    setOccurredAt(todayISO());
    setAccountId(reference?.accounts[0]?.id ?? "");
    setAppSlug("gpay");
    setPurpose("other");
    setCountsAsSpend(false);
    setNote("");
  }, [open, prefillPersonId, reference]);

  // Gifts and splits are real spending; loans and repayments are not.
  React.useEffect(() => {
    if (purpose === "gift" || purpose === "split" || purpose === "shared")
      setCountsAsSpend(true);
    if (purpose === "loan" || purpose === "repayment") setCountsAsSpend(false);
  }, [purpose]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width="520px"
      title="Record a transfer"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={createTransfer.isPending}
            disabled={toPaise(amount) <= 0 || !personId}
            onClick={() => {
              createTransfer.mutate(
                {
                  direction,
                  personId,
                  amountPaise: toPaise(amount),
                  occurredAt,
                  accountId: accountId || null,
                  paymentAppSlug: appSlug || null,
                  purpose,
                  countsAsSpend,
                  note: note.trim(),
                },
                { onSuccess: () => onOpenChange(false) },
              );
            }}
          >
            Record
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Segmented
          fullWidth
          value={direction}
          onChange={setDirection}
          options={[
            { value: "sent", label: "I sent money" },
            { value: "received", label: "I received money" },
          ]}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Person" required>
            <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Choose someone</option>
              {reference?.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount" required>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum"
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <Input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </Field>
          <Field label="Reason">
            <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="other">Other</option>
              <option value="loan">Loan</option>
              <option value="repayment">Paying back</option>
              <option value="split">Splitting a bill</option>
              <option value="shared">Shared expense</option>
              <option value="gift">Gift</option>
              <option value="salary">Salary or income</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Not recorded</option>
              {reference?.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Through">
            <Select value={appSlug} onChange={(e) => setAppSlug(e.target.value)}>
              <option value="">Not recorded</option>
              {reference?.apps.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-[9px] border border-rule-strong px-3 py-2.5">
          <span className="text-[0.8438rem]">
            Count this as my spending
            <span className="mt-0.5 block text-[0.75rem] text-ink-3">
              On for gifts and your share of a split, off for loans
            </span>
          </span>
          <Switch checked={countsAsSpend} onCheckedChange={setCountsAsSpend} />
        </label>

        <Field label="Note">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was it for?"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function PersonDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createPerson = useCreatePerson();
  const [name, setName] = React.useState("");
  const [relation, setRelation] = React.useState("friend");
  const [upiHandle, setUpiHandle] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setRelation("friend");
    setUpiHandle("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a person"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              createPerson.mutate({
                name: name.trim(),
                relation,
                upiHandle: upiHandle.trim(),
              });
              onOpenChange(false);
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Who is it?"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Relation">
            <Select value={relation} onChange={(e) => setRelation(e.target.value)}>
              <option value="friend">Friend</option>
              <option value="family">Family</option>
              <option value="colleague">Colleague</option>
              <option value="flatmate">Flatmate</option>
              <option value="merchant">Merchant</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="UPI handle">
            <Input
              value={upiHandle}
              onChange={(e) => setUpiHandle(e.target.value)}
              placeholder="name@bank"
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
