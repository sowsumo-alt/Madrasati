"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { GraduationCap, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import { LanguageToggle } from "./language-toggle";
import { navItemsByRole, type NavKey } from "./nav-items";

interface AppShellProps {
  children: React.ReactNode;
  navKey: NavKey;
  schoolName: string;
  userName: string;
  roleLabel: string;
}

export function AppShell({
  children,
  navKey,
  schoolName,
  userName,
  roleLabel,
}: AppShellProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = navItemsByRole[navKey];

  const navContent = (
    <>
      <div className="flex items-center gap-2 px-5 py-5 text-white">
        <GraduationCap className="h-6 w-6 text-accent-300" strokeWidth={2} />
        <span className="text-base font-semibold tracking-tight">
          Madrasati
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/directeur" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-700 text-white"
                  : "text-primary-100/70 hover:bg-primary-800/60 hover:text-white",
              )}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={2} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary-100/70 transition-colors hover:bg-primary-800/60 hover:text-white"
        >
          <LogOut className="h-4.5 w-4.5" strokeWidth={2} />
          {t("nav.logout")}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar — desktop */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-primary-900">
        {navContent}
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-primary-900">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 text-primary-100/70"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:pl-64 print:pl-0">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-foreground/70 lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5.5 w-5.5" />
            </button>
            <span className="text-sm font-medium text-foreground/80">
              {schoolName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-foreground">
                {userName}
              </span>
              <span className="text-xs text-foreground/50">{roleLabel}</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
