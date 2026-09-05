"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Info,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
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
import {
  useCreateRule,
  useDeleteRule,
  useInstrument,
  useReference,
  useSummary,
  useUpdateInstrument,
  useUpdateRule,
} from "@/lib/client-api";
import { formatMoney, formatMoneyShort, percentFromBps, toPaise } from "@/lib/money";
import { monthName } from "@/lib/rewards/periods";
import { CapMeter } from "@/components/dashboard/card-tile";
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

  const { data, isLoading } = useInstrument(id, year);
  const { data: summaryData } = useSummary(year, now.getMonth() + 1);
  const { data: reference } = useReference();
  const updateInstrument = useUpdateInstrument();
  const createRule = useCreateRule();

  const [editingRule, setEditingRule] = React.useState<RewardRule | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false);
  const reduce = useReducedMotion();

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
  const options = safeJson<Record<string, unknown>>(instrument.options, {});
  const cardFlags = Array.isArray(options.flags)
    ? (options.flags as { key: string; label: string; hint?: string; default: boolean }[])
    : [];

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
            <p className="text-[0.6875rem] text-white/65">earned back</p>
            <p className="figure text-[1.375rem]">
              {formatMoneyShort(cardSummary?.rewardValuePaise ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {instrument.sourceNote && (
        <div className="flex gap-2.5 rounded-[11px] border border-accent/20 bg-accent-soft p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-[0.8125rem] leading-relaxed text-ink-2">
            {instrument.sourceNote}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* ----------------------------------------------------- the rules */}
        <div className="space-y-4">
          <Panel
            title="Reward rules"
            subtitle="Checked most specific first. Edit any of these to match your statement."
            bodyClassName="p-0"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditingRule(null);
                  setRuleDialogOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Add rule
              </Button>
            }
          >
            {rules.length === 0 ? (
              <p className="px-4 py-8 text-center text-[0.8438rem] text-ink-2">
                This card has no standing reward programme. Log offers on individual
                expenses instead.
              </p>
            ) : (
              <ul className="divide-y divide-rule">
                {rules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    rewardUnit={instrument.rewardUnit}
                    onEdit={() => {
                      setEditingRule(rule);
                      setRuleDialogOpen(true);
                    }}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Rewards through the year" bodyClassName="p-4">
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
                            {formatMoney(p.rewardPaise)} earned
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
                  {formatMoney(cardSummary.rewardLostPaise)} of reward was lost this
                  month because caps were already full.
                </p>
              )}
            </Panel>
          )}

          <Panel title="Card settings">
            <div className="space-y-3">
              {cardFlags.length > 0 && (
                <div className="space-y-2.5">
                  {cardFlags.map((flag) => (
                    <label
                      key={flag.key}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-[0.8438rem]">
                        {flag.label} by default
                        <span className="mt-0.5 block text-[0.75rem] text-ink-3">
                          Pre-fills the question on each new expense. Past expenses
                          keep the answer you gave at the time.
                        </span>
                      </span>
                      <Switch
                        checked={!!flag.default}
                        onCheckedChange={(v) =>
                          updateInstrument.mutate({
                            id,
                            options: {
                              ...options,
                              flags: cardFlags.map((f) =>
                                f.key === flag.key ? { ...f, default: v } : f,
                              ),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              <Field label="Statement day" hint="Used for statement-cycle caps">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  defaultValue={instrument.statementDay}
                  onBlur={(e) =>
                    updateInstrument.mutate({
                      id,
                      statementDay: Number(e.target.value),
                    })
                  }
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Card-wide cap" hint={instrument.rewardUnit}>
                  <Input
                    type="number"
                    defaultValue={instrument.overallCapUnits ?? ""}
                    placeholder="none"
                    onBlur={(e) =>
                      updateInstrument.mutate({
                        id,
                        overallCapUnits: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field label="Cap resets">
                  <Select
                    defaultValue={instrument.overallCapPeriod}
                    onChange={(e) =>
                      updateInstrument.mutate({
                        id,
                        overallCapPeriod: e.target.value,
                      })
                    }
                  >
                    <option value="none">No cap</option>
                    <option value="month">Monthly</option>
                    <option value="quarter">Quarterly</option>
                    <option value="year">Yearly</option>
                    <option value="statement">Per statement</option>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Annual fee">
                  <Input
                    inputMode="decimal"
                    defaultValue={instrument.annualFeePaise / 100}
                    onBlur={(e) =>
                      updateInstrument.mutate({
                        id,
                        annualFeePaise: toPaise(e.target.value),
                      })
                    }
                    className="tnum"
                  />
                </Field>
                <Field label="Forex markup %">
                  <Input
                    inputMode="decimal"
                    defaultValue={instrument.forexMarkupBps / 100}
                    onBlur={(e) =>
                      updateInstrument.mutate({
                        id,
                        forexMarkupBps: Math.round(Number(e.target.value) * 100),
                      })
                    }
                    className="tnum"
                  />
                </Field>
              </div>

              <Field label="Notes on this card's terms">
                <Textarea
                  defaultValue={instrument.sourceNote}
                  onBlur={(e) =>
                    updateInstrument.mutate({ id, sourceNote: e.target.value })
                  }
                />
              </Field>
            </div>
          </Panel>

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

      <RuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        instrumentId={id}
        rewardUnit={instrument.rewardUnit}
        rule={editingRule}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ rows */

function RuleRow({
  rule,
  rewardUnit,
  onEdit,
}: {
  rule: RewardRule;
  rewardUnit: string;
  onEdit: () => void;
}) {
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
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

      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        <Switch
          checked={rule.active}
          onCheckedChange={(v) => updateRule.mutate({ id: rule.id, active: v })}
        />
        <Button variant="ghost" size="icon" aria-label="Edit rule" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete rule"
          onClick={() => deleteRule.mutate(rule.id)}
        >
          <Trash2 className="size-3.5 text-alert" />
        </Button>
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
  const { data: reference } = useReference();

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
