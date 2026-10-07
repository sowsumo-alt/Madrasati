"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Sprout } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { SA_NAV, type SaNavItem } from "./nav";

/** Barre latérale de l'espace Super Admin : marque, menu par rubriques, devise. */
export function SaSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const statut = useSearchParams().get("statut");

  return (
    <div className="flex h-full flex-col">
      <Link href="/super-admin" onClick={onNavigate} className="flex items-center gap-3 px-5 pb-6 pt-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-700/10 ring-1 ring-border dark:bg-white/5">
          <Logo className="h-9 w-9" alt="" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-xl font-bold tracking-tight text-foreground">Madrasati</span>
          <span className="block text-xs font-semibold text-accent-600 dark:text-accent-300">Super Admin</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]" aria-label="Menu Super Admin">
        {SA_NAV.map((group, index) => (
          <div key={group.label ?? `groupe-${index}`} className="space-y-0.5">
            {group.label && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavEntry key={item.label} item={item} pathname={pathname} statut={statut} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted/60 px-4 py-3.5">
          <Sprout className="h-8 w-8 shrink-0 text-primary-600 dark:text-primary-300" strokeWidth={1.75} />
          <p className="text-xs font-medium leading-snug text-foreground/75">Ensemble pour une meilleure éducation</p>
        </div>
      </div>
    </div>
  );
}

const ROW = "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";

function NavEntry({
  item,
  pathname,
  statut,
  onNavigate,
}: {
  item: SaNavItem;
  pathname: string;
  statut: string | null;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const childActive = item.children?.some((c) => c.statut && c.statut === statut) ?? false;
  const [open, setOpen] = useState(childActive);

  if (item.soon) {
    return (
      <span className={cn(ROW, "cursor-default text-foreground/40")} title="Bientôt disponible" data-testid="sa-nav-soon">
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="shrink-0 rounded-full bg-accent-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-700 dark:text-accent-200">
          Bientôt
        </span>
      </span>
    );
  }

  if (item.children) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(ROW, "text-foreground/75 hover:bg-surface-muted hover:text-foreground", childActive && "text-foreground")}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate text-start">{item.label}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-foreground/40 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mb-1 ms-6 mt-0.5 space-y-0.5 border-s border-border ps-3">
            {item.children.map((child) => {
              const active = Boolean(child.statut) && child.statut === statut;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    active ? "bg-surface-muted font-semibold text-foreground" : "text-foreground/60 hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const path = item.href!.split(/[?#]/)[0];
  // Le tableau de bord est actif sans filtre ni ancre ; une page à part, sur son chemin.
  const active = path === "/super-admin" ? pathname === path && !statut && item.label === "Tableau de bord" : pathname.startsWith(path);
  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        ROW,
        active
          ? "bg-sa-active font-semibold text-sa-active-ink shadow-sm shadow-black/20"
          : "text-foreground/75 hover:bg-surface-muted hover:text-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}
