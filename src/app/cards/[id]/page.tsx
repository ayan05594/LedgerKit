"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Info,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
} from "recharts";
import { useReducedMotion } from "motion/react";
import type { RewardRule } from "@/db/schema";
import type { CreditCardResearch } from "@/data/credit-card-research";
import {
  useCreateRule,
  useInstrument,
  useReference,
  useSummary,
  useUpdateRule,
} from "@/lib/client-api";
import { formatMoney, formatMoneyShort, percentFromBps, toPaise } from "@/lib/money";
import { monthName } from "@/lib/rewards/periods";
import { rewardAutomationEnabled } from "@/lib/rewards/coverage";
import { CapMeter } from "@/components/dashboard/card-tile";
import { CardBillingDashboard } from "@/components/cards/card-billing";
import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Panel,
  Select,
  Spinner,
  Switch,
  Textarea,
  Tooltip,
} from "@/components/ui/primitives";
import { DataLoadError } from "@/components/ui/data-load-error";

const PERIOD_WORD = {
  month: "mo",
  quarter: "qtr",
  year: "yr",
  statement: "cycle",
  none: "",
} as const;

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const now = new Date();
  const year = now.getFullYear();

  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useInstrument(id, year);
  const { data: summaryData } = useSummary(year, now.getMonth() + 1);
  const { data: reference } = useReference();
  const reduce = useReducedMotion();

  if (error) {
    return (
      <Panel>
        <DataLoadError
          title="Card details could not be loaded"
          error={error}
          onRetry={refetch}
          isRetrying={isFetching}
        />
      </Panel>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-5" />
      </div>
    );
  }

  const { instrument, rules, trend } = data;
  const cardSummary = summaryData?.summary.cards.find(
    (c) => c.instrument.id === id,
  );
  const perks = safeJson<string[]>(instrument.perks, []);
  const excluded = safeJson<string[]>(instrument.excludedCategories, []);
  const instrumentOptions = safeJson<Record<string, unknown>>(
    instrument.options,
    {},
  );
  const research = readCardResearch(instrumentOptions.catalogResearch);
  const rewardSourceUrl = firstUrl(research?.rewardSourceUrl);
  const sourceNote = readableSourceNote(instrument.sourceNote);
  const rewardIsCalculable = rewardAutomationEnabled(instrument);
  const rewardIsEstimate = instrument.rewardCoverage === "partial";

  return (
    <div className="space-y-4">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        All cards
      </Link>

      {/* -------------------------------------------------------- card face */}
      <div
        className="flex flex-wrap items-end justify-between gap-4 rounded-[16px] p-5 text-white"
        style={{
          background: `linear-gradient(135deg, ${instrument.colorFrom} 0%, ${instrument.colorTo} 100%)`,
        }}
      >
        <div className="min-w-0">
          <h1 className="text-[1.25rem] font-semibold tracking-[-0.02em]">
            {instrument.name}
          </h1>
          <p className="mt-1 text-[0.8125rem] text-white/70">
            {instrument.issuer} · {instrument.network.toUpperCase()} ·{" "}
            {instrument.kind} · pays in {instrument.rewardUnit}
          </p>
        </div>
        <div className="flex gap-5 sm:gap-6">
          <div>
            <p className="text-[0.6875rem] text-white/65">spent this month</p>
            <p className="figure text-[1.25rem] sm:text-[1.375rem]">
              {formatMoneyShort(cardSummary?.netSpendPaise ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-[0.6875rem] text-white/65">
              {rewardIsCalculable
                ? rewardIsEstimate
                  ? "estimated back"
                  : "earned back"
                : "reward tracking"}
            </p>
            <p className="figure text-[1.375rem]">
              {rewardIsCalculable
                ? formatMoneyShort(cardSummary?.rewardValuePaise ?? 0)
                : "Manual"}
            </p>
          </div>
        </div>
      </div>

      <CardBillingDashboard instrumentId={id} />

      {sourceNote && (
        <div className="flex gap-2.5 rounded-[11px] border border-accent/20 bg-accent-soft p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-[0.8125rem] leading-relaxed text-ink-2">
            {sourceNote}
          </p>
        </div>
      )}

      {rewardIsEstimate && (
        <div className="flex gap-2.5 rounded-[11px] border border-warn/25 bg-warn-soft p-3 text-warn">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-[0.8125rem] leading-relaxed">
            Partial reward coverage: LedgerKit can calculate the supported rules,
            but every figure on this page is an estimate. Confirm final rewards and
            exclusions against your issuer statement.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* ----------------------------------------------------- the rules */}
        <div className="space-y-4">
          <Panel
            title="Reward rules"
            subtitle={
              instrument.isCatalogCard
                ? rewardIsEstimate
                  ? "Supported rules are checked most specific first. Results are estimates; official catalogue rules are read-only."
                  : "Checked most specific first. Official catalogue rules are read-only."
                : "This private card stays manual. Enter the reward shown on your statement when you log each expense."
            }
            bodyClassName="p-0"
          >
            {rules.length === 0 ? (
              <p className="px-4 py-8 text-center text-[0.8438rem] text-ink-2">
                {instrument.isCatalogCard
                  ? rewardIsCalculable
                    ? "No supported reward rules are available for this card yet."
                    : "LedgerKit has not automated this card's current reward terms yet. Use the official source below before relying on a reward figure."
                  : "No automated rules are attached to user-added cards, so LedgerKit will never invent a rate for this card."}
              </p>
            ) : (
              <ul className="divide-y divide-rule">
                {rules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    rewardUnit={instrument.rewardUnit}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {research && (
            <Panel
              title="Reward programme"
              subtitle="Research supplied for this exact card variant. Blank fields remain unknown rather than being treated as zero."
            >
              <div className="space-y-4">
                <ResearchText
                  label="Base reward"
                  value={research.baseReward}
                  prominent
                />
                <ResearchText
                  label="Accelerated rewards"
                  value={research.acceleratedRewards}
                  prominent
                />
                <dl className="grid gap-3 sm:grid-cols-2">
                  <ResearchFact
                    label="Reward-point value"
                    value={research.rewardPointValue}
                  />
                  <ResearchFact label="Caps" value={research.caps} />
                  <ResearchFact
                    label="Minimum transaction"
                    value={research.minimumTransaction}
                  />
                  <ResearchFact
                    label="Forex markup"
                    value={research.forexMarkup}
                  />
                </dl>
                {(research.excludedCategories ||
                  research.excludedMerchants) && (
                  <div className="grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
                    <ResearchText
                      label="Excluded categories or MCCs"
                      value={research.excludedCategories}
                    />
                    <ResearchText
                      label="Excluded merchants"
                      value={research.excludedMerchants}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-3 text-[0.75rem] text-ink-3">
                  <span>
                    Effective: {research.effectiveDate ?? "not recorded"}
                  </span>
                  {research.rewardSourceType && (
                    <span>Source: {research.rewardSourceType}</span>
                  )}
                  {research.rewardResearchDate && (
                    <span>Checked: {research.rewardResearchDate}</span>
                  )}
                </div>
              </div>
            </Panel>
          )}

          <Panel title="Rewards through the year" bodyClassName="p-4">
            {rewardIsCalculable ? (
            <div className="h-[168px] w-full">
              <ResponsiveContainer>
                <BarChart data={trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="month"
                    tickFormatter={(m: number) => monthName(m)}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#8B90A0", fontSize: 11 }}
                  />
                  <RTooltip
                    cursor={{ fill: "#ECEEF2" }}
                    content={({ payload }) => {
                      const p = payload?.[0]?.payload as
                        | { month: number; rewardPaise: number; netPaise: number }
                        | undefined;
                      if (!p) return null;
                      return (
                        <div className="rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white">
                          <div>{monthName(p.month, true)}</div>
                          <div className="tnum">
                            {formatMoney(p.rewardPaise)}{" "}
                            {rewardIsEstimate ? "estimated" : "earned"}
                          </div>
                          <div className="tnum text-white/60">
                            on {formatMoney(p.netPaise)}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="rewardPaise"
                    radius={[3, 3, 0, 0]}
                    fill={instrument.colorFrom}
                    isAnimationActive={!reduce}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            ) : (
              <div className="flex min-h-[168px] items-center justify-center px-4 text-center">
                <p className="max-w-[48ch] text-[0.8125rem] leading-relaxed text-ink-2">
                  Reward totals are hidden until this card's caps, exclusions and
                  redemption value have been encoded from current issuer terms.
                </p>
              </div>
            )}
          </Panel>
        </div>

        {/* -------------------------------------------------------- sidebar */}
        <div className="space-y-4">
          {cardSummary && cardSummary.caps.length > 0 && (
            <Panel title="Caps right now">
              <div className="space-y-3">
                {cardSummary.caps.map((cap) => (
                  <CapMeter
                    key={cap.ruleId}
                    label={cap.ruleName}
                    pct={cap.pctUsed}
                    used={cap.usedUnits}
                    total={cap.capUnits}
                    unit={instrument.rewardUnit}
                    period={PERIOD_WORD[cap.capPeriod]}
                    headroomPaise={cap.headroomSpendPaise}
                  />
                ))}
              </div>
              {cardSummary.rewardLostPaise > 0 && (
                <p className="mt-3 rounded-[9px] bg-warn-soft px-2.5 py-2 text-[0.75rem] text-warn">
                  {formatMoney(cardSummary.rewardLostPaise)} of reward was
                  {rewardIsEstimate ? " estimated to be " : " "}lost this month
                  because caps were already full.
                </p>
              )}
            </Panel>
          )}

          {instrument.isCatalogCard ? (
            <Panel title="Verified card information">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-[0.8125rem]">
                <div>
                  <dt className="text-ink-3">Annual fee</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {knownFee(instrument.annualFeeKnown, instrument.annualFeePaise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-3">Joining fee</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {knownFee(instrument.joiningFeeKnown, instrument.joiningFeePaise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-3">Forex markup</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {research?.forexMarkup ??
                    (instrument.rewardCoverage === "exact"
                      ? percentFromBps(instrument.forexMarkupBps)
                      : "Check issuer terms")}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-3">Reward automation</dt>
                  <dd className="mt-0.5 font-semibold capitalize text-ink">
                    {rewardIsEstimate
                      ? "Partial — estimates only"
                      : rewardIsCalculable
                        ? "Automated"
                        : "Manual"}
                  </dd>
                </div>
              </dl>
              {instrument.feeNote && (
                <p className="mt-4 rounded-[9px] bg-sunken px-2.5 py-2 text-[0.75rem] leading-relaxed text-ink-2">
                  {instrument.feeNote}
                </p>
              )}
              <div className="mt-4 border-t border-rule pt-3">
                <p className="text-[0.75rem] leading-relaxed text-ink-3">
                  Research checked {instrument.verifiedAt || "date not recorded"}.
                  Source type and effective-date notes appear with the reward
                  programme. Issuers can change terms without notice.
                </p>
                {instrument.officialUrl && (
                  <a
                    className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-accent hover:text-ink"
                    href={instrument.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check official card page
                    <ExternalLink className="size-3.5" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
                {rewardSourceUrl &&
                  rewardSourceUrl !== instrument.officialUrl && (
                    <a
                      className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-accent hover:text-ink"
                      href={rewardSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open reward terms source
                      <ExternalLink className="size-3.5" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
              </div>
            </Panel>
          ) : (
            <Panel title="Private manual card">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-[0.8125rem]">
                <div>
                  <dt className="text-ink-3">Issuer</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{instrument.issuer}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Network</dt>
                  <dd className="mt-0.5 font-semibold uppercase text-ink">
                    {instrument.network}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 rounded-[9px] bg-sunken px-2.5 py-2 text-[0.75rem] leading-relaxed text-ink-2">
                This card is visible only in your account. Its rates and fees are
                intentionally not inferred. Enter statement-confirmed rewards on
                each expense, and manage whether the card appears in your wallet
                from Settings.
              </p>
              <Link
                href="/settings#my-cards"
                className="mt-3 inline-flex text-[0.8125rem] font-semibold text-accent hover:text-ink"
              >
                Manage wallet in Settings
              </Link>
            </Panel>
          )}

          {perks.length > 0 && (
            <Panel title="Perks">
              <ul className="space-y-2">
                {perks.map((perk) => (
                  <li
                    key={perk}
                    className="flex gap-2 text-[0.8125rem] leading-relaxed text-ink-2"
                  >
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                    {perk}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {excluded.length > 0 && (
            <Panel
              title="Earns nothing on"
              subtitle="Card-wide exclusions, whatever the rules say"
            >
              <div className="flex flex-wrap gap-1.5">
                {excluded.map((slug) => {
                  const cat = reference?.categories.find((c) => c.slug === slug);
                  return (
                    <Chip key={slug} tone="neutral">
                      {cat?.name ?? slug}
                    </Chip>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ rows */

function ResearchText({
  label,
  value,
  prominent = false,
}: {
  label: string;
  value: string | null;
  prominent?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </p>
      <p
        className={
          prominent
            ? "mt-1 text-[0.875rem] font-medium leading-relaxed text-ink"
            : "mt-1 text-[0.8125rem] leading-relaxed text-ink-2"
        }
      >
        {value}
      </p>
    </div>
  );
}

function ResearchFact({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-[10px] bg-sunken p-3">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </dt>
      <dd className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">
        {value ?? "Not verified"}
      </dd>
    </div>
  );
}

function RuleRow({
  rule,
  rewardUnit,
}: {
  rule: RewardRule;
  rewardUnit: string;
}) {
  const merchants = safeJson<string[]>(rule.matchMerchants, []);
  const apps = safeJson<string[]>(rule.matchApps, []);
  const cats = safeJson<string[]>(rule.matchCategories, []);

  const scope: string[] = [];
  if (merchants.length) scope.push(`${merchants.length} merchants`);
  if (apps.length) scope.push(apps.join(", "));
  if (cats.length) scope.push(`${cats.length} categories`);
  if (rule.channel !== "any") scope.push(rule.channel);
  if (rule.isBase) scope.push("fallback for everything else");
  if (rule.requiresFlag)
    scope.push(
      `only when ${humanFlag(rule.requiresFlag)} is ${rule.requiresFlagValue ? "yes" : "no"}`,
    );

  return (
    <li className="row-hover flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.875rem] font-medium">{rule.name}</span>
          <span className="text-[0.875rem] font-semibold text-gain tnum">
            {rule.rateType === "percent"
              ? percentFromBps(rule.rateBps)
              : `${rule.pointsPerBlock} per ₹${rule.blockSizePaise / 100}`}
          </span>
          {rule.capUnits != null ? (
            <Chip tone="warn">
              max {rewardUnit === "INR" ? "₹" : ""}
              {rule.capUnits.toLocaleString("en-IN")}
              {rewardUnit !== "INR" ? ` ${rewardUnit}` : ""} /{" "}
              {rule.capPeriod === "quarter" ? "quarter" : rule.capPeriod}
            </Chip>
          ) : (
            <Chip tone="gain">uncapped</Chip>
          )}
          {rule.priority > 0 && (
            <Tooltip content="Overrides the usual specificity order">
              <span className="chip chip-accent">priority {rule.priority}</span>
            </Tooltip>
          )}
          {!rule.active && <Chip tone="neutral">off</Chip>}
        </div>
        {scope.length > 0 && (
          <p className="mt-1 text-[0.75rem] text-ink-3">{scope.join(" · ")}</p>
        )}
        {rule.minTxnPaise > 0 && (
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
            Minimum {formatMoney(rule.minTxnPaise)} a transaction
          </p>
        )}
        {rule.notes && (
          <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-2">
            {rule.notes}
          </p>
        )}
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- dialog */

function RuleDialog({
  open,
  onOpenChange,
  instrumentId,
  rewardUnit,
  rule,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instrumentId: string;
  rewardUnit: string;
  rule: RewardRule | null;
}) {
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const { data: reference } = useReference(open);

  const [name, setName] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [cap, setCap] = React.useState("");
  const [capPeriod, setCapPeriod] = React.useState("none");
  const [channel, setChannel] = React.useState("any");
  const [minTxn, setMinTxn] = React.useState("");
  const [priority, setPriority] = React.useState("0");
  const [merchantsText, setMerchantsText] = React.useState("");
  const [appsText, setAppsText] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isBase, setIsBase] = React.useState(false);
  const [requiresFlag, setRequiresFlag] = React.useState("");
  const [requiresFlagValue, setRequiresFlagValue] = React.useState("yes");

  React.useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? "");
    setRate(rule ? String(rule.rateBps / 100) : "");
    setCap(rule?.capUnits != null ? String(rule.capUnits) : "");
    setCapPeriod(rule?.capPeriod ?? "none");
    setChannel(rule?.channel ?? "any");
    setMinTxn(rule ? String(rule.minTxnPaise / 100) : "");
    setPriority(String(rule?.priority ?? 0));
    setMerchantsText(safeJson<string[]>(rule?.matchMerchants ?? "[]", []).join(", "));
    setAppsText(safeJson<string[]>(rule?.matchApps ?? "[]", []).join(", "));
    setNotes(rule?.notes ?? "");
    setIsBase(rule?.isBase ?? false);
    setRequiresFlag(rule?.requiresFlag ?? "");
    setRequiresFlagValue(rule?.requiresFlagValue === false ? "no" : "yes");
  }, [open, rule]);

  const parseList = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  function save() {
    const payload = {
      name: name.trim() || "Unnamed rule",
      rateType: "percent",
      rateBps: Math.round(Number(rate || 0) * 100),
      capUnits: cap ? Number(cap) : null,
      capPeriod: cap ? capPeriod : "none",
      channel,
      minTxnPaise: toPaise(minTxn || "0"),
      priority: Number(priority || 0),
      matchMerchants: parseList(merchantsText),
      matchApps: parseList(appsText),
      isBase,
      requiresFlag: requiresFlag.trim() || null,
      requiresFlagValue: requiresFlagValue === "yes",
      notes: notes.trim(),
    };
    if (rule) updateRule.mutate({ id: rule.id, ...payload });
    else createRule.mutate({ instrumentId, ...payload });
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width="560px"
      title={rule ? "Edit reward rule" : "New reward rule"}
      description="Leave the merchant and app lists empty to have this rule apply broadly."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {rule ? "Save rule" : "Add rule"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Myntra"
            />
          </Field>
          <Field label="Rate %">
            <Input
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="tnum"
              placeholder="5"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Cap (${rewardUnit})`} hint="Leave empty for uncapped">
            <Input
              inputMode="numeric"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className="tnum"
              placeholder="4000"
            />
          </Field>
          <Field label="Cap resets">
            <Select
              value={capPeriod}
              onChange={(e) => setCapPeriod(e.target.value)}
              disabled={!cap}
            >
              <option value="none">No reset</option>
              <option value="month">Every month</option>
              <option value="quarter">Every quarter</option>
              <option value="year">Every year</option>
              <option value="statement">Every statement cycle</option>
            </Select>
          </Field>
        </div>

        <Field
          label="Merchants"
          hint="Comma-separated slugs, e.g. myntra, flipkart"
        >
          <Input
            value={merchantsText}
            onChange={(e) => setMerchantsText(e.target.value)}
            placeholder="Leave empty to match any merchant"
          />
        </Field>

        <Field
          label="Payment apps"
          hint={`Known slugs: ${(reference?.apps ?? []).slice(0, 6).map((a) => a.slug).join(", ")}…`}
        >
          <Input
            value={appsText}
            onChange={(e) => setAppsText(e.target.value)}
            placeholder="e.g. smartbuy, payzapp"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="any">Any</option>
              <option value="online">Online</option>
              <option value="offline">In store</option>
              <option value="upi">UPI</option>
            </Select>
          </Field>
          <Field label="Minimum ₹">
            <Input
              inputMode="decimal"
              value={minTxn}
              onChange={(e) => setMinTxn(e.target.value)}
              className="tnum"
            />
          </Field>
          <Field label="Priority" hint="Higher overrides">
            <Input
              inputMode="numeric"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="tnum"
            />
          </Field>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-[9px] border border-rule-strong px-3 py-2.5">
          <span className="text-[0.8438rem]">
            Use as the fallback rate
            <span className="mt-0.5 block text-[0.75rem] text-ink-3">
              Applies when no other rule matches
            </span>
          </span>
          <Switch checked={isBase} onCheckedChange={setIsBase} />
        </label>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field
            label="Only when a condition holds"
            hint="Flag key asked on the expense, e.g. primeMember"
          >
            <Input
              value={requiresFlag}
              onChange={(e) => setRequiresFlag(e.target.value)}
              placeholder="Leave empty to always apply"
            />
          </Field>
          <Field label="Condition is">
            <Select
              value={requiresFlagValue}
              onChange={(e) => setRequiresFlagValue(e.target.value)}
              disabled={!requiresFlag.trim()}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything from the terms worth remembering"
          />
        </Field>
      </div>
    </Dialog>
  );
}

/** "primeMember" -> "prime member" */
function humanFlag(key: string) {
  return key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function readableSourceNote(raw: string) {
  if (!raw) return "";
  const parsed = safeJson<unknown>(raw, raw);
  if (Array.isArray(parsed)) {
    return parsed.filter((value): value is string => typeof value === "string").join(" ");
  }
  return typeof parsed === "string" ? parsed : raw;
}

function readCardResearch(value: unknown): CreditCardResearch | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CreditCardResearch>;
  if (
    typeof candidate.issuer !== "string" ||
    typeof candidate.name !== "string" ||
    (candidate.status !== "Selectable" &&
      candidate.status !== "Discontinued")
  ) {
    return null;
  }
  return candidate as CreditCardResearch;
}

function firstUrl(value: string | null | undefined) {
  return (
    value
      ?.split(/\r?\n/)
      .map((url) => url.trim())
      .find(Boolean) ?? null
  );
}

function knownFee(known: boolean, amountPaise: number) {
  if (!known) return "Check issuer terms";
  return amountPaise === 0 ? "No fee" : formatMoney(amountPaise);
}
