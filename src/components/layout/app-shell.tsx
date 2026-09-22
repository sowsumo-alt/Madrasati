"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, Search, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { Logo } from "@/components/brand/logo";
import type { Plan } from "@/lib/plans";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { Sidebar } from "./sidebar";
import { LanguageMenu } from "./language-menu";
import { FullscreenButton } from "./fullscreen-button";
import { UserMenu } from "./user-menu";
import type { NavKey } from "./nav-items";

interface AppShellProps {
  children: React.ReactNode;
  navKey: NavKey;
  schoolName: string;
  userName: string;
  /** Clé de traduction du rôle (voir ROLE_LABEL_KEYS) : affiché sous le nom. */
  roleKey: string;
  /** Cible de la recherche globale ; la barre est masquée si absente. */
  searchHref?: string;
  /** Pastille rouge de l'icône cloche (0 = pas de pastille). */
  alertCount?: number;
  alertHref?: string;
  alertLabel?: string;
  /** Formule de l'école — détermine les entrées de menu verrouillées. */
  plan: Plan;
}

/**
 * Cadre de l'application : barre latérale verte pleine hauteur (tiroir sur
 * mobile), en-tête avec recherche, cloche, plein écran, langue et compte.
 */
export function AppShell({
  children,
  navKey,
  schoolName,
  userName,
  roleKey,
  searchHref,
  alertCount = 0,
  alertHref = "#",
  alertLabel = "Notifications",
  plan,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchHref || query.trim() === "") return;
    router.push(`${searchHref}?q=${encodeURIComponent(query.trim())}`);
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Fond illustré (feuillage, toque et livres) fixé à l'écran : il
          reste en place pendant le défilement et commence au bord de la
          barre latérale ; retourné en arabe, pour que le feuillage reste du
          côté opposé à la barre. */}
      <div
        aria-hidden
        className="no-print pointer-events-none fixed inset-0 bg-[url(/backgrounds/app-bg.webp)] bg-cover bg-center lg:start-64 rtl:-scale-x-100"
      />

      {/* Barre latérale — bureau */}
      <aside className="no-print fixed inset-y-0 start-0 z-40 hidden w-64 bg-gradient-to-b from-primary-800 via-primary-800 to-primary-900 lg:block">
        <Sidebar navKey={navKey} plan={plan} />
      </aside>

      {/* Barre latérale — tiroir mobile */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] bg-gradient-to-b from-primary-800 to-primary-900 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute end-3 top-6 z-10 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={t("header.closeMenu")}
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar navKey={navKey} plan={plan} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="relative lg:ps-64 print:ps-0">
        <header className="no-print sticky top-0 z-30 bg-background/40 backdrop-blur-md">
          <div className="flex h-[4.5rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              className="shrink-0 rounded-lg p-2 text-foreground/70 transition-colors hover:bg-surface-muted lg:hidden"
              aria-label={t("header.openMenu")}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden">
              <Logo className="h-8 w-8" />
              <span className="hidden text-lg font-bold tracking-tight text-primary-800 sm:inline">
                Madrasati
              </span>
            </Link>

            {searchHref && (
              // À partir de lg seulement : sur tablette, entre le logo et les
              // boutons, le champ était réduit à « Rechercher u… ».
              <form onSubmit={onSearch} className="hidden min-w-0 flex-1 lg:block">
                <div className="relative max-w-xl">
                  <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("header.searchPlaceholder")}
                    aria-label={t("common.search")}
                    className="h-11 w-full rounded-full border border-border bg-surface pe-11 ps-11 text-sm text-foreground shadow-sm transition-colors placeholder:text-foreground/40 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="submit"
                    aria-label={t("common.search")}
                    className="absolute end-3.5 top-1/2 -translate-y-1/2 text-foreground/50 transition-colors hover:text-primary-700"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            <div className="ms-auto flex items-center gap-1 sm:gap-2.5">
              <Link
                href={alertHref}
                title={alertLabel}
                aria-label={alertLabel}
                className="relative rounded-lg p-2 text-foreground/60 transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
                {alertCount > 0 && (
                  <span className="absolute end-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-background">
                    {alertCount > 99 ? "99+" : alertCount}
                  </span>
                )}
              </Link>
              <FullscreenButton />
              <LanguageMenu />
              <UserMenu
                userName={userName}
                roleLabel={t(roleKey as TranslationKey)}
                schoolName={schoolName}
              />
            </div>
          </div>
        </header>

        {/* La clé force le remontage à chaque navigation : l'animation
            d'entrée rejoue sur chaque nouvelle page, pas seulement au
            premier chargement. */}
        <main key={pathname} className="animate-page-in px-4 py-6 sm:px-6 lg:px-8 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
