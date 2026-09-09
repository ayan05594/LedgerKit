"use client";

import * as React from "react";
import {
  CreditCard,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  useCardSelection,
  useClearTransactions,
  useCreateCategory,
  useCreateMerchant,
  useCreatePaymentApp,
  useReference,
  useSaveCardSelection,
} from "@/lib/client-api";
import { CardSelectionPicker } from "@/components/cards/card-selection";
import { CategoryIcon } from "@/components/expenses/category-picker";
import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Panel,
  Select,
  Sheet,
  Spinner,
} from "@/components/ui/primitives";
import { DataLoadError } from "@/components/ui/data-load-error";

export default function SettingsPage() {
  const {
    data: reference,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useReference();
  const {
    data: cardSelection,
    error: cardSelectionError,
    isLoading: isCardSelectionLoading,
    isFetching: isCardSelectionFetching,
    refetch: refetchCardSelection,
  } = useCardSelection();
  const saveCardSelection = useSaveCardSelection();
  const clearTransactions = useClearTransactions();
  const createCategory = useCreateCategory();
  const createMerchant = useCreateMerchant();
  const createApp = useCreatePaymentApp();
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [merchantOpen, setMerchantOpen] = React.useState(false);
  const [appOpen, setAppOpen] = React.useState(false);
  const [cardsOpen, setCardsOpen] = React.useState(false);
  const [draftCardIds, setDraftCardIds] = React.useState<string[]>([]);
  const [draftNoCards, setDraftNoCards] = React.useState(false);

  if (error) {
    return (
      <Panel>
        <DataLoadError
          title="Settings could not be loaded"
          error={error}
          onRetry={refetch}
          isRetrying={isFetching}
        />
      </Panel>
    );
  }

  if (isLoading || !reference) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-5" />
      </div>
    );
  }

  const parents = reference.categories.filter((c) => !c.parentSlug);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">
          Settings
        </h1>
        <p className="hint mt-0.5">
          The vocabulary the app uses to describe your spending, and what to do when
          you want a clean slate.
        </p>
      </header>

      <div id="my-cards" className="scroll-mt-5">
        <Panel
          title="My cards"
          subtitle="These are the only cards shown while logging an expense"
          action={
            <Button
              size="sm"
              variant="secondary"
              disabled={!cardSelection}
              onClick={openCardManager}
            >
              <CreditCard className="size-3.5" />
              Manage cards
            </Button>
          }
        >
          {cardSelectionError ? (
            <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.8125rem] font-medium">
                  Your card choices could not be loaded
                </p>
                <p className="hint mt-0.5">{cardSelectionError.message}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={isCardSelectionFetching}
                onClick={() => void refetchCardSelection()}
              >
                Try again
              </Button>
            </div>
          ) : isCardSelectionLoading || !cardSelection ? (
            <div className="flex items-center gap-2 py-2 text-[0.8125rem] text-ink-2">
              <Spinner />
              Loading your wallet…
            </div>
          ) : cardSelection.selectedIds.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-[11px] border border-dashed border-rule-strong bg-paper px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-sunken text-ink-3">
                  <CreditCard className="size-4" />
                </span>
                <div>
                  <p className="text-[0.875rem] font-semibold">
                    No credit cards in your wallet
                  </p>
                  <p className="hint mt-0.5">
                    Add one whenever you want LedgerKit to track its rewards.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={openCardManager}>
                Choose cards
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cardSelection.catalog
                .filter((card) => cardSelection.selectedIds.includes(card.id))
                .map((card) => (
                  <div
                    key={card.id}
                    className="flex min-w-0 items-center gap-3 rounded-[11px] border border-rule-strong bg-paper p-3"
                  >
                    <span
                      className="flex h-9 w-14 shrink-0 items-end rounded-[7px] p-1.5 text-white shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${card.colorFrom}, ${card.colorTo})`,
                      }}
                    >
                      <CreditCard className="size-3 text-white/80" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.8125rem] font-semibold">
                        {card.shortName}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-3">
                        {card.issuer} · {card.network.toUpperCase()}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Categories"
        subtitle="Miscellaneous and Other ask you to name each spend yourself"
        action={
          <Button size="sm" variant="secondary" onClick={() => setCategoryOpen(true)}>
            <Plus className="size-3.5" />
            Add
          </Button>
        }
      >
        <div className="space-y-3">
          {parents.map((parent) => {
            const children = reference.categories.filter(
              (c) => c.parentSlug === parent.slug,
            );
            return (
              <div key={parent.slug}>
                <p className="mb-1.5 text-[0.75rem] font-medium text-ink-3">
                  {parent.name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(children.length ? children : [parent]).map((c) => (
                    <span
                      key={c.slug}
                      className="flex items-center gap-1.5 rounded-[8px] border border-rule-strong px-2 py-1.5 text-[0.8125rem]"
                    >
                      <CategoryIcon
                        name={c.icon}
                        className="size-3.5"
                        color={c.colorHex}
                      />
                      <span style={{ color: c.colorHex }}>{c.name}</span>
                      {c.requiresLabel && (
                        <span className="text-[0.6875rem] text-ink-3">
                          needs a label
                        </span>
                      )}
                      {!c.isSystem && <Chip tone="accent">yours</Chip>}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Merchants"
          subtitle={`${reference.merchants.length} known — merchant rules key off these`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setMerchantOpen(true)}>
              <Plus className="size-3.5" />
              Add
            </Button>
          }
        >
          <div className="flex max-h-[260px] flex-wrap gap-1.5 overflow-y-auto">
            {reference.merchants.map((m) => (
              <span
                key={m.slug}
                className="flex items-center gap-1.5 rounded-[8px] border border-rule px-2 py-1 text-[0.8125rem]"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: m.colorHex }}
                />
                {m.name}
                <code className="text-[0.6875rem] text-ink-3">{m.slug}</code>
              </span>
            ))}
          </div>
        </Panel>

        <Panel
          title="Payment apps"
          subtitle="Which rail carried the money — SmartBuy and PayZapp change reward rates"
          action={
            <Button size="sm" variant="secondary" onClick={() => setAppOpen(true)}>
              <Plus className="size-3.5" />
              Add
            </Button>
          }
        >
          <div className="flex max-h-[260px] flex-wrap gap-1.5 overflow-y-auto">
            {reference.apps.map((a) => (
              <span
                key={a.slug}
                className="flex items-center gap-1.5 rounded-[8px] border border-rule px-2 py-1 text-[0.8125rem]"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: a.colorHex }}
                />
                {a.name}
                <code className="text-[0.6875rem] text-ink-3">{a.slug}</code>
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Your data"
        subtitle="Stored securely in your private Supabase database"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            <Trash2 className="size-3.5" />
            Clear all transactions
          </Button>
        </div>
        <p className="hint mt-3">
          Clearing removes every expense, adjustment, refund and transfer. Your card
          choices, accounts and people stay as they are.
        </p>
      </Panel>

      <Panel title="About card information">
        <div className="flex gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gain" />
          <p className="text-[0.8438rem] leading-relaxed text-ink-2">
            Catalogue details are sourced from official issuer pages and carry a
            verification date. Banks can revise rates, caps and eligibility at any
            time, so use the source link on a card page to confirm the latest terms
            before making a financial decision.
          </p>
        </div>
      </Panel>

      <Sheet
        open={cardsOpen}
        onOpenChange={(nextOpen) => {
          setCardsOpen(nextOpen);
          if (!nextOpen) saveCardSelection.reset();
        }}
        title="Choose your credit cards"
        description="Your expense form and rewards dashboard will only show the cards saved here."
        width="780px"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                saveCardSelection.reset();
                setCardsOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={draftCardIds.length === 0 && !draftNoCards}
              loading={saveCardSelection.isPending}
              onClick={() =>
                saveCardSelection.mutate(
                  {
                    instrumentIds: draftCardIds,
                    noCards: draftNoCards,
                  },
                  {
                    onSuccess: (result) => {
                      if (result.reauthRequired) {
                        window.location.assign(
                          result.redirectTo ?? "/login?walletSaved=1",
                        );
                        return;
                      }
                      saveCardSelection.reset();
                      setCardsOpen(false);
                    },
                  },
                )
              }
            >
              Save wallet
            </Button>
          </>
        }
      >
        {cardsOpen && cardSelection && (
          <CardSelectionPicker
            catalog={cardSelection.catalog}
            selectedIds={draftCardIds}
            noCards={draftNoCards}
            onSelectedIdsChange={(ids) => {
              saveCardSelection.reset();
              setDraftCardIds(ids);
            }}
            onNoCardsChange={(value) => {
              saveCardSelection.reset();
              setDraftNoCards(value);
            }}
          />
        )}
        {saveCardSelection.error && (
          <p
            role="alert"
            className="mt-4 rounded-[9px] border border-alert/25 bg-alert-soft px-3 py-2 text-[0.8125rem] text-alert"
          >
            {saveCardSelection.error.message}
          </p>
        )}
      </Sheet>

      <Dialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all transactions?"
        description="Every expense, discount, refund and transfer will be deleted. Cards, rules, accounts and people are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Keep them
            </Button>
            <Button
              variant="danger"
              loading={clearTransactions.isPending}
              onClick={() => {
                clearTransactions.mutate({});
                setConfirmClear(false);
              }}
            >
              Clear everything
            </Button>
          </>
        }
      />

      <AddThingDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title="Add a category"
        parents={parents.map((p) => ({ value: p.slug, label: p.name }))}
        onSubmit={(values) => createCategoryHandler(values)}
      />
      <AddThingDialog
        open={merchantOpen}
        onOpenChange={setMerchantOpen}
        title="Add a merchant"
        parents={reference.categories.map((c) => ({ value: c.slug, label: c.name }))}
        parentLabel="Usual category"
        onSubmit={(values) => createMerchantHandler(values)}
      />
      <AddThingDialog
        open={appOpen}
        onOpenChange={setAppOpen}
        title="Add a payment app"
        onSubmit={(values) => createAppHandler(values)}
      />
    </div>
  );

  function createCategoryHandler(values: { name: string; parent?: string; color: string }) {
    createCategory.mutate({
      name: values.name,
      parentSlug: values.parent || null,
      colorHex: values.color,
    });
  }
  function createMerchantHandler(values: { name: string; parent?: string; color: string }) {
    createMerchant.mutate({
      name: values.name,
      categorySlug: values.parent || null,
      colorHex: values.color,
    });
  }
  function createAppHandler(values: { name: string; color: string }) {
    createApp.mutate({ name: values.name, colorHex: values.color });
  }

  function openCardManager() {
    if (!cardSelection) return;
    setDraftCardIds(cardSelection.selectedIds);
    setDraftNoCards(
      cardSelection.completed && cardSelection.selectedIds.length === 0,
    );
    setCardsOpen(true);
  }
}

function AddThingDialog({
  open,
  onOpenChange,
  title,
  parents,
  parentLabel = "Sits under",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  parents?: { value: string; label: string }[];
  parentLabel?: string;
  onSubmit: (values: { name: string; parent?: string; color: string }) => void;
}) {
  const [name, setName] = React.useState("");
  const [parent, setParent] = React.useState("");
  const [color, setColor] = React.useState("#4C6EF5");

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setParent("");
    setColor("#4C6EF5");
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              onSubmit({ name: name.trim(), parent, color });
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
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {parents && (
            <Field label={parentLabel}>
              <Select value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">Top level</option>
                {parents.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Colour">
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[38px] p-1"
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
