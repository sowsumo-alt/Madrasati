import type { ReactNode } from "react";
import { School } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getTranslations } from "@/lib/i18n/server";

/**
 * Carte de présentation Madrasati en tête de la colonne de droite. Accueille
 * les actions rapides et l'aide (`children`), comme sur la maquette.
 */
export async function SchoolCard({ children }: { children?: ReactNode }) {
  const { t } = await getTranslations();

  return (
    <section className="animate-page-in overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft">
      <div className="relative">
        <div className="relative isolate h-28 overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500">
          <svg aria-hidden className="absolute inset-0 -z-10 h-full w-full text-white/15">
            <defs>
              <pattern id="brand-dots" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.3" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#brand-dots)" />
          </svg>
          <School
            aria-hidden
            className="absolute -bottom-6 end-3 -z-10 h-32 w-32 text-white/10"
            strokeWidth={1}
          />
        </div>
        <span className="absolute -bottom-7 start-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface shadow-md ring-1 ring-border">
          <Logo className="h-11 w-11" alt="" />
        </span>
      </div>

      <div className="px-5 pb-5 pt-10">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Madrasati</h2>
        <p className="text-sm font-medium text-primary-600">{t("nav.appTagline")}</p>
        <p className="mt-2 text-sm text-foreground/60">{t("dashboard.appDescription")}</p>
        {children}
      </div>
    </section>
  );
}
