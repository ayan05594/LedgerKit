"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
  color?: string;
  icon?: React.ReactNode;
  group?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyLabel = "Nothing matches",
  onCreate,
  createLabel = "Add",
  allowClear,
  clearLabel = "None",
  disabled,
  id,
  name,
  ariaLabel,
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  onCreate?: (label: string) => void | Promise<void>;
  createLabel?: string;
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = options.find((o) => o.value === value) ?? null;
  const grouped = React.useMemo(() => {
    const map = new Map<string, ComboOption[]>();
    for (const option of options) {
      const key = option.group ?? "";
      map.set(key, [...(map.get(key) ?? []), option]);
    }
    return [...map.entries()];
  }, [options]);

  const exactExists = options.some(
    (o) => o.label.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          name={name}
          aria-label={ariaLabel}
          type="button"
          disabled={disabled}
          className="field flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed"
        >
          <span
            className={cn("flex min-w-0 items-center gap-2", !selected && "text-ink-3")}
          >
            {selected?.color && (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: selected.color }}
              />
            )}
            {selected?.icon}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={5}
          collisionPadding={12}
          className="anim-fade z-50 w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden rounded-[11px] border border-rule bg-surface shadow-[0_8px_28px_rgba(16,24,40,0.14)]"
        >
          <Command shouldFilter loop>
            <div className="flex items-center gap-2 border-b border-rule px-3">
              <Search className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              <Command.Input
                aria-label={`Search ${ariaLabel ?? placeholder}`}
                value={query}
                onValueChange={setQuery}
                placeholder={placeholder}
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-ink-3"
              />
            </div>
            <Command.List className="max-h-[264px] overflow-y-auto p-1.5">
              <Command.Empty className="px-2 py-6 text-center text-[0.8125rem] text-ink-3">
                {emptyLabel}
              </Command.Empty>

              {allowClear && (
                <Command.Item
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-[7px] px-2 py-1.5 text-[0.8438rem] text-ink-2 data-[selected=true]:bg-sunken"
                >
                  {clearLabel}
                </Command.Item>
              )}

              {grouped.map(([group, items]) => (
                <Command.Group
                  key={group || "default"}
                  heading={
                    group ? (
                      <span className="px-2 pb-1 pt-2 text-[0.6875rem] font-medium text-ink-3">
                        {group}
                      </span>
                    ) : undefined
                  }
                >
                  {items.map((option) => (
                    <Command.Item
                      key={option.value}
                      value={`${option.label} ${option.hint ?? ""}`}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex cursor-pointer items-center gap-2 rounded-[7px] px-2 py-1.5 text-[0.8438rem] data-[selected=true]:bg-sunken"
                    >
                      {option.color && (
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: option.color }}
                        />
                      )}
                      {option.icon}
                      <span className="truncate">{option.label}</span>
                      {option.hint && (
                        <span className="ml-auto shrink-0 text-[0.75rem] text-ink-3">
                          {option.hint}
                        </span>
                      )}
                      {option.value === value && (
                        <Check className="ml-auto size-3.5 shrink-0 text-gain" />
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}

              {onCreate && query.trim() && !exactExists && (
                <Command.Item
                  value={`__create__${query}`}
                  forceMount
                  onSelect={async () => {
                    await onCreate(query.trim());
                    setOpen(false);
                    setQuery("");
                  }}
                  className="mt-1 flex cursor-pointer items-center gap-2 rounded-[7px] border-t border-rule px-2 py-2 text-[0.8438rem] font-medium data-[selected=true]:bg-sunken"
                >
                  <Plus className="size-3.5 text-accent" />
                  {createLabel} “{query.trim()}”
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
