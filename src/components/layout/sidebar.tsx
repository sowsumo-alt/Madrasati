"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Lock, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import { Logo } from "@/components/brand/logo";
import { planHasFeature, type Plan } from "@/lib/plans";
import { navGroupsByRole, type NavItem, type NavKey } from "./nav-items";

const HOME_HREFS = new Set(["/directeur", "/enseignant", "/parent"]);

/**
 * Un directeur voit les fonctionnalités non incluses dans son plan, grisées
 * avec un cadenas (invitation à mettre à niveau) — c'est lui le décideur de
 * l'abonnement. Un enseignant ou un parent ne voit rien de tout ça : les
 * entrées correspondantes disparaissent purement et simplement du menu.
 */
function visibleNavItems(items: NavItem[], plan: Plan, navKey: NavKey) {
  if (navKey !== "director") {
    return items
      .filter((item) => !item.feature || planHasFeature(plan, item.feature))
      .map((item) => ({ item, locked: false }));
  }
  return items.map((item) => ({
    item,
    locked: Boolean(item.feature) && !planHasFeature(plan, item.feature!),
  }));
}

/**
 * Pages sans entrée de menu propre, rattachées à celle dont elles
 * prolongent le travail : l'inscription d'une famille à « Élèves », la fiche
 * d'une famille à « Parents ».
 */
function menuPath(pathname: string) {
  if (pathname.startsWith("/directeur/familles/inscription")) return "/directeur/eleves";
  if (pathname.startsWith("/directeur/familles/")) return "/directeur/parents";
  return pathname;
}

function isActive(rawPathname: string, href: string) {
  const pathname = menuPath(rawPathname);
  // Une entrée qui porte un filtre (?statut=…) ou vise une section (#annees)
  // partage son chemin avec une autre entrée : seule cette dernière s'allume.
  if (/[?#]/.test(href)) return false;
  if (HOME_HREFS.has(href)) return pathname === href;
  // Avec la barre oblique : « Élèves » ne s'allume plus sur « Élèves à surveiller ».
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Contenu de la barre latérale : marque, menu par rubriques, devise en pied. */
export function Sidebar({
  navKey,
  plan,
  onNavigate,
}: {
  navKey: NavKey;
  plan: Plan;
  /** Appelé au clic sur un lien — ferme le tiroir sur mobile. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const navGroups = navGroupsByRole[navKey];

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-5 pb-5 pt-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
          <Logo className="h-8 w-8" alt="" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-xl font-bold tracking-tight text-white">Madrasati</span>
          <span className="block truncate text-xs text-white/60">{t("nav.appTagline")}</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
        {navGroups.map((group, groupIndex) => (
          <div key={group.labelKey ?? `group-${groupIndex}`} className="space-y-0.5">
            {group.labelKey && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent-300">
                {t(group.labelKey)}
              </p>
            )}
            {visibleNavItems(group.items, plan, navKey).map(({ item, locked }) => {
              const active = !locked && isActive(pathname, item.href);
              const Icon = item.icon;
              const href = locked
                ? `/directeur/fonctionnalite-verrouillee?feature=${item.feature}`
                : item.href;
              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    locked
                      ? "font-medium text-white/40 hover:bg-white/5 hover:text-white/60"
                      : active
                        ? "bg-primary-500 font-semibold text-white shadow-sm shadow-black/20"
                        : "font-medium text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                  {locked ? (
                    <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  ) : item.soon ? (
                    <span className="shrink-0 rounded-full bg-accent-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-200">
                      {t("nav.soon")}
                    </span>
                  ) : (
                    !HOME_HREFS.has(item.href) && (
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform rtl:rotate-180",
                          active ? "text-white/80" : "text-white/35 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5",
                        )}
                      />
                    )
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5">
          <Sprout className="h-8 w-8 shrink-0 text-primary-300" strokeWidth={1.75} />
          <p className="text-xs font-medium leading-snug text-white/75">{t("nav.motto")}</p>
        </div>
      </div>
    </div>
  );
}
