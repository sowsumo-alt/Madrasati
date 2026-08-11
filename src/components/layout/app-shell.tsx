"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, LogOut, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "./language-toggle";
import { navItemsByRole, type NavKey } from "./nav-items";

interface AppShellProps {
  children: React.ReactNode;
  navKey: NavKey;
  schoolName: string;
  userName: string;
  roleLabel: string;
  /** Cible de la recherche globale ; la barre est masquée si absente. */
  searchHref?: string;
  /** Pastille rouge de l'icône cloche (0 = pas de pastille). */
  alertCount?: number;
  alertHref?: string;
  alertLabel?: string;
}

export function AppShell({
  children,
  navKey,
  schoolName,
  userName,
  roleLabel,
  searchHref,
  alertCount = 0,
  alertHref = "#",
  alertLabel = "Notifications",
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navItems = navItemsByRole[navKey];

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchHref || query.trim() === "") return;
    router.push(`${searchHref}?q=${encodeURIComponent(query.trim())}`);
    setMobileOpen(false);
  }

  const navContent = (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/directeur" &&
              item.href !== "/enseignant" &&
              item.href !== "/parent" &&
              pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary-600 font-semibold text-white shadow-sm"
                  : "font-medium text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        <p className="truncate px-3 pb-2 text-xs text-white/50" title={schoolName}>
          {schoolName}
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4.5 w-4.5" strokeWidth={2} />
          {t("nav.logout")}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-surface px-3 sm:gap-4 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="hidden text-xl font-bold tracking-tight text-primary-800 sm:inline">
            Madrasati
          </span>
        </Link>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="shrink-0 rounded-lg p-2 text-foreground/60 transition-colors hover:bg-surface-muted lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {searchHref && (
          <form onSubmit={onSearch} className="hidden flex-1 md:block">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                aria-label={t("common.search")}
                className="h-10 w-full rounded-full border border-border bg-background pl-11 pr-11 text-sm text-foreground transition-colors placeholder:text-foreground/40 focus:border-primary-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                aria-label={t("common.search")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 transition-colors hover:text-primary-700"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <Link
            href={alertHref}
            title={alertLabel}
            aria-label={alertLabel}
            className="relative rounded-lg p-2 text-foreground/60 transition-colors hover:bg-surface-muted"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {alertCount > 99 ? "99+" : alertCount}
              </span>
            )}
          </Link>
          <Link
            href="/mon-compte"
            title="Mon compte"
            className="flex items-center gap-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-700 text-sm font-semibold text-white ring-2 ring-primary-100">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold text-foreground">
                {userName}
              </span>
              <span className="text-xs text-foreground/50">{roleLabel}</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Barre latérale — bureau */}
      <aside className="no-print fixed inset-y-0 left-0 top-16 z-30 hidden w-64 flex-col bg-primary-700 lg:flex">
        {navContent}
      </aside>

      {/* Barre latérale — tiroir mobile */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-primary-700">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-base font-bold tracking-tight text-white">
                Madrasati
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-white/70 hover:text-white"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}

      <div className="pt-16 lg:pl-64 print:pt-0 print:pl-0">
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
