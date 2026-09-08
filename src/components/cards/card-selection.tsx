"use client";

import * as React from "react";
import {
  Ban,
  Check,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
  X,
} from "lucide-react";
import type { CardCatalogItem } from "@/lib/card-catalog";
import { useCreateManualCard } from "@/lib/client-api";
import {
  Button,
  Dialog,
  Field,
  Input,
  Select,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const ALL_BANKS = "__all__";
const SELECTED_CARDS = "__selected__";

export function CardSelectionPicker({
  catalog,
  selectedIds,
  noCards,
  onSelectedIdsChange,
  onNoCardsChange,
  className,
}: {
  catalog: CardCatalogItem[];
  selectedIds: string[];
  noCards: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onNoCardsChange: (value: boolean) => void;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [bank, setBank] = React.useState(ALL_BANKS);
  const [expandedBanks, setExpandedBanks] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [pendingCards, setPendingCards] = React.useState<CardCatalogItem[]>([]);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manualIssuer, setManualIssuer] = React.useState("");
  const [manualName, setManualName] = React.useState("");
  const [manualNetwork, setManualNetwork] = React.useState<
    "visa" | "mastercard" | "rupay" | "amex" | "diners" | "other"
  >("other");
  const createManualCard = useCreateManualCard();
  const searchId = React.useId();
  const selected = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const availableCatalog = React.useMemo(
    () => [
      ...catalog,
      ...pendingCards.filter(
        (pending) => !catalog.some((card) => card.id === pending.id),
      ),
    ],
    [catalog, pendingCards],
  );

  // This setup is intentionally for credit cards. A discontinued, archived, or
  // non-credit card is only retained when the user had already selected it.
  const selectableCatalog = React.useMemo(
    () =>
      availableCatalog.filter(
        (card) =>
          card.kind === "credit" &&
          !card.archived &&
          card.availability !== "discontinued",
      ),
    [availableCatalog],
  );
  const selectableIds = React.useMemo(
    () => new Set(selectableCatalog.map((card) => card.id)),
    [selectableCatalog],
  );
  const displayedCatalog = React.useMemo(
    () => [
      ...selectableCatalog,
      ...availableCatalog.filter(
        (card) => selected.has(card.id) && !selectableIds.has(card.id),
      ),
    ],
    [availableCatalog, selectableCatalog, selectableIds, selected],
  );

  const banks = React.useMemo(
    () =>
      [...new Set(displayedCatalog.map((card) => card.issuer || "Other"))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [displayedCatalog],
  );

  React.useEffect(() => {
    if (bank !== ALL_BANKS && bank !== SELECTED_CARDS && !banks.includes(bank)) {
      setBank(ALL_BANKS);
    }
  }, [bank, banks]);

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return displayedCatalog.filter((card) => {
      if (bank === SELECTED_CARDS && !selected.has(card.id)) return false;
      if (
        bank !== ALL_BANKS &&
        bank !== SELECTED_CARDS &&
        (card.issuer || "Other") !== bank
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        card.name,
        card.shortName,
        card.issuer,
        card.network,
        card.catalogCategory,
        card.catalogSummary,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [bank, displayedCatalog, query, selected]);

  const grouped = React.useMemo(() => {
    const groups = new Map<string, CardCatalogItem[]>();
    for (const card of visible) {
      const issuer = card.issuer || "Other";
      groups.set(issuer, [...(groups.get(issuer) ?? []), card]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [visible]);

  function toggleCard(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(
      availableCatalog.filter((card) => next.has(card.id)).map((card) => card.id),
    );
    if (next.size > 0) onNoCardsChange(false);
  }

  function toggleNoCards() {
    const next = !noCards;
    onNoCardsChange(next);
    if (next) onSelectedIdsChange([]);
  }

  async function addManualCard() {
    if (!manualIssuer.trim() || !manualName.trim()) return;
    try {
      const card = await createManualCard.mutateAsync({
        issuer: manualIssuer,
        name: manualName,
        network: manualNetwork,
      });
      setPendingCards((current) => [
        ...current.filter((item) => item.id !== card.id),
        card,
      ]);
      onSelectedIdsChange([...new Set([...selectedIds, card.id])]);
      onNoCardsChange(false);
      setBank(card.issuer);
      setExpandedBanks((current) => new Set(current).add(card.issuer));
      setManualOpen(false);
      setManualIssuer("");
      setManualName("");
      setManualNetwork("other");
    } catch {
      // The shared mutation and the inline message present the server error.
    }
  }

  const hasFilters = query.trim().length > 0 || bank !== ALL_BANKS;
  const selectedCards = displayedCatalog.filter((card) => selected.has(card.id));

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" aria-atomic="true">
          <p className="text-[0.875rem] font-semibold">
            {noCards
              ? "No cards - confirmed"
              : `${selectedIds.length} ${selectedIds.length === 1 ? "card" : "cards"} selected`}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
            You can change this later in Settings.
          </p>
        </div>
        {selectedIds.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onSelectedIdsChange([])}>
            Clear selection
          </Button>
        )}
      </div>

      {selectedCards.length > 0 && (
        <div
          className="rounded-[12px] border border-accent/20 bg-accent-soft/70 p-3"
          aria-label="Cards currently selected"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-accent">
            <CreditCard className="size-3.5" aria-hidden />
            Your wallet
          </div>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {selectedCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => toggleCard(card.id)}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-accent/15 bg-surface px-2.5 py-1.5 text-[0.75rem] font-medium text-ink shadow-sm transition-colors hover:border-accent/35"
                aria-label={`Remove ${card.name} from your wallet`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: card.colorFrom }}
                  aria-hidden
                />
                {card.shortName}
                <X className="size-3 text-ink-3" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-[12px] border border-rule bg-paper p-3 sm:p-4">
        <div>
          <p className="text-[0.8125rem] font-semibold">Credit-card catalogue</p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
            Search official products and cards you have added, or narrow by bank.
          </p>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            id={searchId}
            name="cardCatalogSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cards, banks or networks"
            aria-label="Search available credit cards"
            className="bg-surface pl-9 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear card search"
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-ink-3 hover:bg-sunken hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div
          className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
          role="group"
          aria-label="Filter cards by bank"
        >
          <FilterButton active={bank === ALL_BANKS} onClick={() => setBank(ALL_BANKS)}>
            All banks
          </FilterButton>
          <FilterButton
            active={bank === SELECTED_CARDS}
            onClick={() => setBank(SELECTED_CARDS)}
          >
            Selected ({selectedIds.length})
          </FilterButton>
          {banks.map((issuer) => (
            <FilterButton
              key={issuer}
              active={bank === issuer}
              onClick={() => setBank(issuer)}
            >
              {issuer}
            </FilterButton>
          ))}
        </div>
        <p className="text-[0.6875rem] text-ink-3" aria-live="polite">
          Showing {visible.length} of {displayedCatalog.length} cards
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center rounded-[14px] border border-dashed border-rule-strong px-6 py-12 text-center">
          <SearchX className="size-6 text-ink-3" aria-hidden />
          <p className="mt-3 text-sm font-medium">No cards match</p>
          <p className="hint mt-1">
            {hasFilters
              ? "Try another bank or a shorter search."
              : "No catalogue cards are available right now. You can continue with the no-card option below."}
          </p>
          {hasFilters && (
            <Button
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setQuery("");
                setBank(ALL_BANKS);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([issuer, cards]) => {
            const headingId = `bank-${slug(issuer)}`;
            const isCompactOverview =
              bank === ALL_BANKS && query.trim().length === 0;
            const isExpanded =
              !isCompactOverview || expandedBanks.has(issuer);
            const selectedCount = cards.filter((card) =>
              selected.has(card.id),
            ).length;
            return (
              <section
                key={issuer}
                aria-labelledby={headingId}
                className={cn(
                  isCompactOverview &&
                    "overflow-hidden rounded-[12px] border border-rule-strong bg-surface",
                )}
              >
                {isCompactOverview ? (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-sunken/50"
                    aria-expanded={isExpanded}
                    aria-controls={headingId + "-cards"}
                    onClick={() =>
                      setExpandedBanks((current) => {
                        const next = new Set(current);
                        if (next.has(issuer)) next.delete(issuer);
                        else next.add(issuer);
                        return next;
                      })
                    }
                  >
                    <span>
                      <span id={headingId} className="block text-[0.8125rem] font-semibold text-ink-2">
                        {issuer}
                      </span>
                      <span className="mt-0.5 block text-[0.6875rem] text-ink-3">
                        {cards.length} {cards.length === 1 ? "card" : "cards"}
                        {selectedCount > 0 &&
                          " · " + selectedCount + " selected"}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 text-ink-3 transition-transform",
                        isExpanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                ) : (
                  <div className="mb-2.5 flex items-baseline justify-between gap-3">
                    <h2 id={headingId} className="text-[0.8125rem] font-semibold text-ink-2">
                      {issuer}
                    </h2>
                    <span className="text-[0.6875rem] text-ink-3">
                      {cards.length} {cards.length === 1 ? "card" : "cards"}
                    </span>
                  </div>
                )}
                {isExpanded && (
                <div
                  id={headingId + "-cards"}
                  className={cn(
                    "grid gap-2 sm:grid-cols-2",
                    isCompactOverview && "border-t border-rule p-2.5",
                  )}
                >
                  {cards.map((card) => (
                    <CardChoice
                      key={card.id}
                      card={card}
                      selected={selected.has(card.id)}
                      retainedOnly={!selectableIds.has(card.id)}
                      onToggle={() => toggleCard(card.id)}
                    />
                  ))}
                </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 rounded-[11px] border border-rule bg-paper px-3 py-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gain" aria-hidden />
        <p className="text-[0.75rem] leading-relaxed text-ink-2">
          Official catalogue details are checked against issuer pages. Open the
          source before applying; banks can change eligibility, fees and benefits.
          Cards added by you remain private and use manual reward tracking.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-[12px] border border-dashed border-rule-strong bg-surface px-3.5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.8125rem] font-semibold">Can&apos;t find your card?</p>
          <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-3">
            Add its bank and product name without guessing any reward terms.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => {
            createManualCard.reset();
            setManualOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          Add missing card
        </Button>
      </div>

      <button
        type="button"
        role="checkbox"
        aria-checked={noCards}
        onClick={toggleNoCards}
        className={cn(
          "flex w-full items-center gap-3 rounded-[12px] border p-3.5 text-left transition-colors sm:p-4",
          noCards
            ? "border-accent bg-accent-soft"
            : "border-rule-strong bg-surface hover:bg-sunken/50",
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[9px]",
            noCards ? "bg-accent text-white" : "bg-sunken text-ink-3",
          )}
        >
          <Ban className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.875rem] font-semibold">
            I do not use a credit card right now
          </span>
          <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-ink-2">
            Continue with bank accounts and UPI only. You can add cards later.
          </span>
        </span>
        <SelectionMark selected={noCards} />
      </button>

      <Dialog
        open={manualOpen}
        onOpenChange={(open) => {
          setManualOpen(open);
          if (!open) createManualCard.reset();
        }}
        title="Add a card that is not listed"
        description="This card is private to your account. LedgerKit will not assume its fees, benefits, or reward rate."
        footer={
          <>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!manualIssuer.trim() || !manualName.trim()}
              loading={createManualCard.isPending}
              onClick={() => void addManualCard()}
            >
              Add and select card
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Issuing bank" htmlFor={`${searchId}-manual-issuer`} required>
            <Input
              id={`${searchId}-manual-issuer`}
              name="manualCardIssuer"
              autoComplete="organization"
              maxLength={80}
              value={manualIssuer}
              onChange={(event) => setManualIssuer(event.target.value)}
              placeholder="e.g. Punjab National Bank"
            />
          </Field>
          <Field label="Card name" htmlFor={`${searchId}-manual-name`} required>
            <Input
              id={`${searchId}-manual-name`}
              name="manualCardName"
              maxLength={120}
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Use the name printed on the card or statement"
            />
          </Field>
          <Field label="Card network" htmlFor={`${searchId}-manual-network`}>
            <Select
              id={`${searchId}-manual-network`}
              name="manualCardNetwork"
              value={manualNetwork}
              onChange={(event) =>
                setManualNetwork(event.target.value as typeof manualNetwork)
              }
            >
              <option value="other">Not sure</option>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="rupay">RuPay</option>
              <option value="amex">American Express</option>
              <option value="diners">Diners Club</option>
            </Select>
          </Field>
          {createManualCard.error && (
            <p
              role="alert"
              className="rounded-[9px] border border-alert/25 bg-alert-soft px-3 py-2 text-[0.8125rem] text-alert"
            >
              {createManualCard.error.message}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function CardChoice({
  card,
  selected,
  retainedOnly,
  onToggle,
}: {
  card: CardCatalogItem;
  selected: boolean;
  retainedOnly: boolean;
  onToggle: () => void;
}) {
  const coverageLabel = {
    exact: "Automated calculation",
    partial: "Partial calculation",
    manual: "Manual tracking",
  }[card.rewardCoverage];
  const hasSource = Boolean(card.officialUrl || card.verifiedAt);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[12px] border transition-[border-color,background-color,box-shadow]",
        selected
          ? "border-accent bg-accent-soft shadow-[0_0_0_1px_rgba(43,59,168,0.08)]"
          : "border-rule-strong bg-surface hover:border-[#aeb4c2] hover:bg-[#fafbfc]",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`${selected ? "Remove" : "Select"} ${card.name}`}
        onClick={onToggle}
        className="group flex min-h-[104px] w-full items-start gap-3 p-3 text-left"
      >
        <span
          className="relative mt-0.5 flex h-10 w-[62px] shrink-0 items-end overflow-hidden rounded-[8px] p-1.5 text-white shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${card.colorFrom}, ${card.colorTo})`,
          }}
          aria-hidden
        >
          <CreditCard className="size-3.5 text-white/80" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.875rem] font-semibold">
            {card.shortName}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.6875rem]">
            <Badge>{titleCase(card.catalogCategory || "everyday")}</Badge>
            {!card.isCatalogCard && (
              <Badge className="bg-accent-soft text-accent">Added by you</Badge>
            )}
            <Badge
              className={cn(
                card.rewardCoverage === "exact" && "bg-gain-soft text-gain",
                card.rewardCoverage === "partial" && "bg-warn-soft text-warn",
              )}
            >
              {coverageLabel}
            </Badge>
            {card.availability !== "active" &&
              card.availability !== "discontinued" && (
                <Badge
                  className={cn(
                    card.availability === "invite_only" &&
                      "bg-accent-soft text-accent",
                    card.availability === "applications_paused" &&
                      "bg-warn-soft text-warn",
                  )}
                >
                  {titleCase(card.availability)}
                </Badge>
              )}
            {retainedOnly && (
              <Badge className="bg-warn-soft text-warn">Previously selected</Badge>
            )}
          </span>
          {card.catalogSummary && (
            <span
              className="mt-1.5 block overflow-hidden text-[0.75rem] leading-relaxed text-ink-2"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {card.catalogSummary}
            </span>
          )}
        </span>
        <SelectionMark selected={selected} />
      </button>
      {hasSource && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule/80 px-3 py-2 text-[0.6875rem] text-ink-3">
          {card.officialUrl && (
            <a
              href={card.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              Official source
              <ExternalLink className="size-3" aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {card.verifiedAt && <span>Verified {formatVerifiedDate(card.verifiedAt)}</span>}
        </div>
      )}
    </article>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded bg-sunken px-1.5 py-0.5 font-medium text-ink-3",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
        selected
          ? "border-accent bg-accent text-white"
          : "border-rule-strong bg-surface text-transparent",
      )}
      aria-hidden
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-[8px] px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors",
        active
          ? "bg-ink text-white"
          : "border border-rule-strong bg-surface text-ink-2 hover:bg-sunken",
      )}
    >
      {children}
    </button>
  );
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatVerifiedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(date);
}
