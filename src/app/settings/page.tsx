"use client";

import * as React from "react";
import { Database, Plus, Tag, Trash2, TriangleAlert } from "lucide-react";
import {
  useClearTransactions,
  useCreateCategory,
  useCreateMerchant,
  useCreatePaymentApp,
  useLoadDemo,
  useReference,
} from "@/lib/client-api";
import { CategoryIcon } from "@/components/expenses/category-picker";
import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Panel,
  Select,
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
  const loadDemo = useLoadDemo();
  const clearTransactions = useClearTransactions();
  const createCategory = useCreateCategory();
  const createMerchant = useCreateMerchant();
  const createApp = useCreatePaymentApp();
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [merchantOpen, setMerchantOpen] = React.useState(false);
  const [appOpen, setAppOpen] = React.useState(false);

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

      <Panel title="Your data" subtitle="Everything lives in a local SQLite file">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={loadDemo.isPending}
            onClick={() => loadDemo.mutate({})}
          >
            <Database className="size-3.5" />
            Load sample transactions
          </Button>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            <Trash2 className="size-3.5" />
            Clear all transactions
          </Button>
        </div>
        <p className="hint mt-3">
          Clearing removes every expense, adjustment, refund and transfer. Your cards,
          reward rules, accounts and people stay as they are.
        </p>
      </Panel>

      <Panel title="A note on the seeded rates">
        <div className="flex gap-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <p className="text-[0.8438rem] leading-relaxed text-ink-2">
            Every rate, cap and exclusion was seeded from published card terms, but
            issuers revise these often and some are worded as &ldquo;up to&rdquo;
            figures that depend on your tier or membership. Check each card&rsquo;s page
            against your own statement and edit anything that does not match — the
            engine only knows what you tell it.
          </p>
        </div>
      </Panel>

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
