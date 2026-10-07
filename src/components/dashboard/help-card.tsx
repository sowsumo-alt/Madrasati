import Link from "next/link";
import { ArrowRight, Lightbulb, MessageCircle } from "lucide-react";
import { getTranslations } from "@/lib/i18n/server";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/lib/contact";

/** Encart « Besoin d'aide ? » de la colonne de droite. */
export async function HelpCard() {
  const { t } = await getTranslations();

  return (
    <div className="mt-4 flex gap-3 rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 p-4 ring-1 ring-emerald-100">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-500">
        <Lightbulb className="h-6 w-6" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{t("dashboard.needHelp")}</p>
        <p className="mt-0.5 text-xs text-foreground/60">{t("dashboard.helpText")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/directeur/aide"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary-600 bg-surface px-3.5 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"
          >
            {t("dashboard.viewHelp")}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
          <a
            href={buildWhatsAppUrl(CONTACT_PHONE, "Bonjour, j'ai besoin d'aide sur Madrasati.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {t("dashboard.contactSupport")}
          </a>
        </div>
      </div>
    </div>
  );
}
