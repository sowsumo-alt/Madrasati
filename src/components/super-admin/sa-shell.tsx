"use client";

import { Suspense, createContext, useContext, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Moon, Search, Stamp, Sun, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SaSidebar } from "./sa-sidebar";
import { SA_THEME_COOKIE, type SaTheme } from "./theme";
import { signOutAndForget } from "@/lib/sign-out";


const SaThemeContext = createContext<SaTheme>("dark");

/** Le thème affiché, pour les éléments dessinés en couleurs fixes (graphiques). */
export function useSaTheme(): SaTheme {
  return useContext(SaThemeContext);
}

export interface SaAlerts {
  pending: number;
  late: number;
  trialsEnding: number;
}

/**
 * Cadre de l'espace Super Admin (maquette « mode sombre ») : barre latérale
 * fixe sur ordinateur, en tiroir sur tablette et téléphone ; en-tête avec
 * recherche des écoles, alertes, langue, compte et bascule clair/sombre.
 */
export function SaShell({
  children,
  adminName,
  initialTheme,
  alerts,
}: {
  children: React.ReactNode;
  adminName: string;
  initialTheme: SaTheme;
  alerts: SaAlerts;
}) {
  const [theme, setTheme] = useState<SaTheme>(initialTheme);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function toggleTheme() {
    const next: SaTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.cookie = `${SA_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div data-sa-theme={theme} className="min-h-screen bg-background text-foreground">
      {/* Barre latérale — ordinateur */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 border-e border-border bg-sa-sidebar lg:block">
        <Suspense>
          <SaSidebar />
        </Suspense>
      </aside>

      {/* Barre latérale — tiroir (tablette, téléphone) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] border-e border-border bg-sa-sidebar shadow-2xl">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute end-3 top-5 rounded-lg p-1.5 text-foreground/60 hover:bg-surface-muted"
            >
              <X className="h-5 w-5" />
            </button>
            <Suspense>
              <SaSidebar onNavigate={() => setDrawerOpen(false)} />
            </Suspense>
          </aside>
        </div>
      )}

      <div className="lg:ps-64">
        <SaTopbar
          adminName={adminName}
          alerts={alerts}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <main className="mx-auto max-w-[110rem] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <SaThemeContext.Provider value={theme}>{children}</SaThemeContext.Provider>
        </main>
      </div>
    </div>
  );
}

function SaTopbar({
  adminName,
  alerts,
  theme,
  onToggleTheme,
  onOpenMenu,
}: {
  adminName: string;
  alerts: SaAlerts;
  theme: SaTheme;
  onToggleTheme: () => void;
  onOpenMenu: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const alertCount = alerts.pending + alerts.late + alerts.trialsEnding;
  const initial = adminName.trim().charAt(0).toUpperCase() || "A";

  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/super-admin?q=${encodeURIComponent(q)}#ecoles` : "/super-admin#ecoles");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[110rem] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="rounded-lg p-2 text-foreground/70 hover:bg-surface-muted lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <form onSubmit={search} className="relative min-w-0 flex-1 md:max-w-xl" role="search">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une école, un directeur, un téléphone…"
            aria-label="Rechercher une école"
            className="h-10 w-full rounded-xl border border-border bg-surface pe-3 ps-9 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            data-testid="sa-search"
          />
        </form>

        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${alertCount} alerte(s)`}
              className="relative rounded-xl p-2.5 text-foreground/70 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              data-testid="sa-alerts"
            >
              <Bell className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                  {alertCount}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[16rem]">
              <p className="border-b border-border px-2.5 pb-2 pt-1.5 text-xs font-semibold text-foreground/60">Alertes</p>
              {alertCount === 0 && <p className="px-2.5 py-3 text-sm text-foreground/60">Rien à signaler.</p>}
              {alerts.pending > 0 && (
                <DropdownMenuItem asChild>
                  <Link href="/super-admin?statut=pending#ecoles">{alerts.pending} école(s) en attente d&apos;activation</Link>
                </DropdownMenuItem>
              )}
              {alerts.late > 0 && (
                <DropdownMenuItem asChild>
                  <Link href="/super-admin?statut=past_due#ecoles">{alerts.late} école(s) en retard de paiement</Link>
                </DropdownMenuItem>
              )}
              {alerts.trialsEnding > 0 && (
                <DropdownMenuItem asChild>
                  <Link href="/super-admin#essais">{alerts.trialsEnding} essai(s) à relancer</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* L'espace Super Admin est en français : la langue est affichée, sans menu à vide. */}
          <span
            className="hidden items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-xs font-semibold text-foreground/80 sm:flex"
            title="Langue de l'espace Super Admin"
          >
            <span aria-hidden className="flex h-3.5 w-5 overflow-hidden rounded-[2px]">
              <span className="w-1/3 bg-[#0055a4]" />
              <span className="w-1/3 bg-white" />
              <span className="w-1/3 bg-[#ef4135]" />
            </span>
            FR
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2.5 rounded-xl p-1 text-start transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:pe-2"
              data-testid="sa-user-menu"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-700 text-sm font-semibold text-white ring-2 ring-accent-300/60">
                {initial}
              </span>
              <span className="hidden min-w-0 flex-col leading-tight md:flex">
                <span className="max-w-[10rem] truncate text-sm font-semibold text-foreground">{adminName}</span>
                <span className="text-xs text-foreground/55">Super Administrateur</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-foreground/50 md:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuItem asChild>
                <Link href="/super-admin/en-tete-officiel">
                  <Stamp className="h-4 w-4 text-foreground/60" />
                  Bloc officiel des bulletins
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => signOutAndForget("/super-admin/login")} className="text-danger">
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
            className={cn("rounded-xl p-2.5 text-foreground/70 transition-colors hover:bg-surface-muted")}
            data-testid="sa-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
