"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import type { Category } from "@/db/schema";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/primitives";

export function CategoryIcon({
  name,
  className,
  color,
}: {
  name: string;
  className?: string;
  color?: string;
}) {
  const Component = (
    Icons as unknown as Record<
      string,
      React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    >
  )[name];
  const Resolved = Component ?? Icons.Circle;
  return (
    <Resolved className={className} style={color ? { color } : undefined} />
  );
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  id,
  labelledBy,
}: {
  categories: Category[];
  value: string;
  onChange: (slug: string) => void;
  id?: string;
  labelledBy?: string;
}) {
  const [query, setQuery] = React.useState("");

  const parents = categories.filter((c) => !c.parentSlug);
  const leaves = categories.filter((c) => c.parentSlug);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelledBy}
      className="rounded-[11px] border border-rule-strong bg-surface"
    >
      <div className="border-b border-rule p-2">
        <Input
          id={id ? `${id}-search` : undefined}
          name="categorySearch"
          aria-label="Search expense categories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories"
          className="border-0 bg-transparent px-1.5 py-1 text-[0.8438rem] focus:shadow-none"
        />
      </div>

      <div className="max-h-[228px] overflow-y-auto p-2">
        {matches ? (
          <div className="flex flex-wrap gap-1.5">
            {matches.length === 0 && (
              <p className="px-1 py-3 text-[0.8125rem] text-ink-3">
                No category by that name. Pick Miscellaneous and type what it was.
              </p>
            )}
            {matches.map((c) => (
              <CategoryChip
                key={c.slug}
                category={c}
                selected={c.slug === value}
                onSelect={onChange}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {parents.map((parent) => {
              const children = leaves.filter((c) => c.parentSlug === parent.slug);
              if (children.length === 0) {
                return (
                  <div key={parent.slug} className="flex flex-wrap gap-1.5">
                    <CategoryChip
                      category={parent}
                      selected={parent.slug === value}
                      onSelect={onChange}
                    />
                  </div>
                );
              }
              return (
                <div key={parent.slug}>
                  <p className="mb-1.5 px-0.5 text-[0.6875rem] font-medium text-ink-3">
                    {parent.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {children.map((c) => (
                      <CategoryChip
                        key={c.slug}
                        category={c}
                        selected={c.slug === value}
                        onSelect={onChange}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  category,
  selected,
  onSelect,
}: {
  category: Category;
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.slug)}
      aria-pressed={selected}
      data-selected={selected}
      className={cn(
        "flex items-center gap-1.5 rounded-[8px] border px-2 py-1.5 text-[0.8125rem] font-medium transition-colors",
        selected
          ? "border-ink bg-ink text-white"
          : "border-rule-strong bg-surface text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      <CategoryIcon
        name={category.icon}
        className={cn("size-3.5", selected && "text-white")}
      />
      <span
        style={!selected ? { color: category.colorHex } : undefined}
        className="whitespace-nowrap"
      >
        {category.name}
      </span>
    </button>
  );
}
