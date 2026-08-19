import Link from "next/link";
import { Lock, MessageCircle, ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/lib/contact";
import { buttonVariants } from "@/components/ui/button";
import {
  PLAN_LABELS,
  PLAN_LABEL_KEYS,
  PLAN_FEATURE_LIST,
  FEATURE_LABEL_KEYS,
  type Feature,
  type Plan,
} from "@/lib/plans";
import { getTranslations } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

/** Formule la moins chère qui inclut cette fonctionnalité. */
function planThatUnlocks(feature: Feature): Plan {
  return PLAN_FEATURE_LIST.advanced.some((f) => f.feature === feature) ? "advanced" : "network";
}

export default async function FeatureLockedPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { feature: rawFeature } = await searchParams;
  const { t } = await getTranslations();
  const tk = (key: string) => t(key as TranslationKey);
  const feature = (
    rawFeature && rawFeature in FEATURE_LABEL_KEYS ? rawFeature : null
  ) as Feature | null;
  const featureLabel = feature
    ? tk(FEATURE_LABEL_KEYS[feature])
    : t("locked.genericFeature");
  const requiredPlan = feature ? planThatUnlocks(feature) : "advanced";

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true },
  });

  const whatsappMessage = `Bonjour, je dirige l'école ${school?.name ?? ""} sur Madrasati et je souhaite mettre à niveau vers la formule ${PLAN_LABELS[requiredPlan]} pour accéder à « ${featureLabel} ».`;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
        <Lock className="h-6 w-6" strokeWidth={2} />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-foreground">
        {t("locked.title")
          .replace("{feature}", featureLabel)
          .replace("{plan}", tk(PLAN_LABEL_KEYS[requiredPlan]))}
      </h1>
      <p className="mt-2 text-sm text-foreground/60">{t("locked.hint")}</p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <a
          href={buildWhatsAppUrl(CONTACT_PHONE, whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "primary" })}
        >
          <MessageCircle className="h-4 w-4" />
          {t("locked.contact")}
        </a>
        <Link href="/directeur/parametres" className={buttonVariants({ variant: "secondary" })}>
          {t("locked.seePlans")}
        </Link>
      </div>

      <Link
        href="/directeur"
        className="mt-8 inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("locked.back")}
      </Link>
    </div>
  );
}
