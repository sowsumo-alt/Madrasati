import Link from "next/link";
import { ArrowRight, ChevronRight, ClipboardPlus, UserRoundPlus, Users } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { getTranslations } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

/**
 * Point de départ d'une inscription, ouvert par « Inscription » dans le menu :
 * le directeur y choisit entre un seul élève et une famille.
 *
 * Les deux cartes ne font qu'ouvrir les parcours existants — le formulaire
 * d'un élève (?new=1 sur la page Élèves) et l'inscription groupée — sans
 * seconde version d'aucun des deux.
 */
export default async function EnrollmentPage() {
  await requireRole(ROLES.DIRECTOR);
  const { t } = await getTranslations();

  const choices: {
    href: string;
    icon: typeof UserRoundPlus;
    title: TranslationKey;
    description: TranslationKey;
  }[] = [
    {
      href: "/directeur/eleves?new=1",
      icon: UserRoundPlus,
      title: "enroll.singleTitle",
      description: "enroll.singleDesc",
    },
    {
      href: "/directeur/familles/inscription",
      icon: Users,
      title: "enroll.familyTitle",
      description: "enroll.familyDesc",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <nav
          aria-label={t("nav.category.schooling")}
          className="mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50"
        >
          <span>{t("nav.category.schooling")}</span>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <span className="font-medium text-foreground/70">{t("nav.enrollment")}</span>
        </nav>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <ClipboardPlus className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("nav.enrollment")}</h1>
            <p className="mt-0.5 text-sm text-foreground/60">{t("enroll.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {choices.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col rounded-2xl border border-border/70 bg-surface/90 p-6 shadow-soft backdrop-blur-sm transition-colors hover:border-primary-300 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:p-7"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/80 text-primary-700 shadow-sm transition-colors group-hover:from-primary-700 group-hover:to-primary-800 group-hover:text-white">
              <Icon className="h-7 w-7" strokeWidth={1.9} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-primary-900">{t(title)}</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-foreground/60">{t(description)}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
              {t("enroll.start")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </span>
          </Link>
        ))}
      </div>

      <p className="text-sm text-foreground/50">{t("enroll.alsoFromStudents")}</p>
    </div>
  );
}
