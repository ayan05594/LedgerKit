"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "icon";
    loading?: boolean;
  }
>(function Button(
  { className, variant = "secondary", size = "md", loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "btn",
        `btn-${variant}`,
        size === "sm" && "btn-sm",
        size === "icon" && "btn-icon",
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ----------------------------------------------------------------- field */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <label className="field-label">
          {label}
          {required && <span className="text-alert"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("field", className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={3}
      className={cn("field resize-y leading-relaxed", className)}
      {...props}
    />
  );
});

/** Native select styled to match — no portal, keyboard friendly, fast. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn("field appearance-none pr-8", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
    </div>
  );
});

/* ------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  fullWidth,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "gap-0.5 rounded-[10px] border border-rule-strong bg-sunken p-0.5",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
              fullWidth && "min-w-0 flex-1",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- switch */

export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full border border-transparent transition-colors",
        checked ? "bg-ink" : "bg-rule-strong",
        disabled && "opacity-50",
      )}
    >
      <SwitchPrimitive.Thumb className="block size-[18px] translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

/* ------------------------------------------------------------------ chip */

export function Chip({
  tone = "neutral",
  children,
  className,
  style,
}: {
  tone?: "neutral" | "gain" | "warn" | "alert" | "accent";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={cn("chip", `chip-${tone}`, className)} style={style}>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- panel */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel overflow-hidden", className)}>
      {(title || action) && (
        <header className="panel-head">
          <div className="min-w-0">
            {title && <h2 className="panel-title truncate">{title}</h2>}
            {subtitle && <p className="hint mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- sheet */

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "560px",
  placement = "side",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  /** "bottom" is a short phone sheet; "side" fills the screen on a phone and
   *  becomes a right-hand panel from the sm breakpoint up. */
  placement?: "side" | "bottom";
}) {
  const bottom = placement === "bottom";
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="anim-fade fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          style={{ ["--sheet-w" as string]: width }}
          className={cn(
            "fixed z-50 flex flex-col bg-surface",
            bottom
              ? "anim-sheet-up inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[18px] border-t border-rule"
              : "anim-sheet-up sm:anim-sheet inset-x-0 bottom-0 top-0 rounded-none border-rule sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-[var(--sheet-w)] sm:border-l",
          )}
        >
          {bottom && (
            <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-rule-strong" />
          )}
          <header className="flex items-start justify-between gap-4 border-b border-rule px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[0.9375rem] font-semibold tracking-[-0.012em]">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="hint mt-0.5">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </header>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5",
              bottom && "pb-[calc(1rem+env(safe-area-inset-bottom))]",
            )}
          >
            {children}
          </div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-paper px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-3.5 sm:pb-3.5 [&>.btn]:flex-1 sm:[&>.btn]:flex-none">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ---------------------------------------------------------------- dialog */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "440px",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="anim-fade fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          style={{ maxWidth: width }}
          className="anim-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[14px] border border-rule bg-surface sm:w-[calc(100%-2rem)]"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-5 sm:px-5">
            <DialogPrimitive.Title className="text-[0.9375rem] font-semibold tracking-[-0.012em]">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="hint mt-1.5">
                {description}
              </DialogPrimitive.Description>
            )}
            {children && <div className="mt-4">{children}</div>}
          </div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-paper px-4 py-3 sm:px-5 sm:py-3.5 [&>.btn]:flex-1 sm:[&>.btn]:flex-none">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* --------------------------------------------------------------- tooltip */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className="anim-fade z-50 max-w-[280px] rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-relaxed text-white"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-ink" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ----------------------------------------------------------- empty state */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-sunken text-ink-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="hint mt-1 max-w-[42ch]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-4 animate-spin text-ink-3", className)}
      aria-label="Loading"
    />
  );
}

export function CheckLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-[0.8125rem] leading-relaxed text-ink-2">
      <Check className="mt-0.5 size-3.5 shrink-0 text-gain" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
