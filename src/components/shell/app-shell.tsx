"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CreditCard,
  Landmark,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Sheet } from "@/components/ui/primitives";
import { ExpenseSheet } from "@/components/expenses/expense-sheet";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: ReceiptText },
  { href: "/cards", label: "Cards & rewards", icon: CreditCard },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/people", label: "People", icon: Users },
  { href: "/pending", label: "Money owed", icon: ArrowLeftRight },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** The four that earn a permanent slot on a phone; the rest live under More. */
const PHONE_TABS = [NAV[0], NAV[1], NAV[2], NAV[5]];
const MORE_LINKS = [NAV[3], NAV[4], NAV[6]];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => setMoreOpen(false), [pathname]);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "n") {
        event.preventDefault();
        setAddOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  }

  if (pathname === "/login" || pathname === "/register") {
    return <>{children}</>;
  }

  const currentLabel =
    NAV.find((item) => isActive(item.href, pathname))?.label ?? "LedgerKit";

  return (
    <div className="min-h-dvh lg:flex">
      {/* --------------------------------------------------- phone top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-rule bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" aria-label="LedgerKit home">
          <Mark />
        </Link>
        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold tracking-[-0.015em]">
          {currentLabel}
        </span>
        <Link
          href="/settings"
          aria-label="Settings"
          className={cn(
            "btn btn-ghost btn-icon",
            pathname.startsWith("/settings") && "text-ink",
          )}
        >
          <Settings className="size-4" />
        </Link>
      </header>

      {/* ------------------------------------------------ desktop left rail */}
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-rule bg-surface px-3 py-4 lg:flex">
        <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
          <Mark />
          <div className="leading-tight">
            <div className="text-[0.9375rem] font-semibold tracking-[-0.02em]">
              LedgerKit
            </div>
            <div className="text-[0.6875rem] text-ink-3">
              spend · rewards · refunds
            </div>
          </div>
        </Link>

        <Button
          variant="primary"
          className="mb-4 w-full justify-center"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          Add expense
          <kbd className="ml-1 rounded border border-white/25 px-1 text-[0.625rem] font-medium text-white/60">
            N
          </kbd>
        </Button>

        <nav className="flex-1 space-y-0.5">
          {NAV.map((item) => (
            <RailLink key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>

        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="mb-3 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[0.875rem] font-medium text-ink-2 transition-colors hover:bg-sunken/60 hover:text-ink"
        >
          <LogOut className="size-4 text-ink-3" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>

        <p className="px-2 text-[0.6875rem] leading-relaxed text-ink-3">
          Rates and caps are seeded from published card terms. Card issuers change
          them often — check the numbers on each card page.
        </p>
      </aside>

      <main className="min-w-0 flex-1">
        {/* Bottom padding clears the phone tab bar and the home indicator. */}
        <div className="mx-auto max-w-[1240px] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
          {children}
        </div>
      </main>

      {/* ---------------------------------------------------- phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-[520px] grid-cols-5 items-end px-1 pt-1">
          <TabLink {...PHONE_TABS[0]} pathname={pathname} />
          <TabLink {...PHONE_TABS[1]} pathname={pathname} />

          <div className="flex justify-center pb-1.5">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-label="Add expense"
              className="flex size-12 items-center justify-center rounded-full bg-ink text-white transition-transform active:scale-95"
            >
              <Plus className="size-5" />
            </button>
          </div>

          <TabLink {...PHONE_TABS[2]} shortLabel="Cards" pathname={pathname} />
          <TabButton
            label="More"
            icon={MoreHorizontal}
            active={MORE_LINKS.some((l) => isActive(l.href, pathname))}
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>

      <Sheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="Everything else"
        placement="bottom"
      >
        <nav className="space-y-1">
          {MORE_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-3 text-[0.9375rem] font-medium",
                isActive(item.href, pathname)
                  ? "bg-sunken text-ink"
                  : "text-ink-2 active:bg-sunken",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-3">
          Rates and caps are seeded from published card terms. Issuers change them
          often — check the numbers on each card page.
        </p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="mt-3 flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-[0.9375rem] font-medium text-ink-2 active:bg-sunken"
        >
          <LogOut className="size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </Sheet>

      <ExpenseSheet open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function RailLink({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
}) {
  const active = isActive(href, pathname);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[0.875rem] font-medium transition-colors",
        active ? "bg-sunken text-ink" : "text-ink-2 hover:bg-sunken/60 hover:text-ink",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("size-4", active ? "text-ink" : "text-ink-3")} />
      {label}
    </Link>
  );
}

function TabLink({
  href,
  label,
  shortLabel,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
}) {
  const active = isActive(href, pathname);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[0.6875rem] font-medium transition-colors",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <Icon className="size-[1.15rem]" />
      <span className="max-w-full truncate">{shortLabel ?? label}</span>
    </Link>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[0.6875rem] font-medium transition-colors",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <Icon className="size-[1.15rem]" />
      {label}
    </button>
  );
}

function Mark() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-ink">
      <Wallet className="size-4 text-white" aria-hidden />
    </span>
  );
}
