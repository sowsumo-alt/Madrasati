import { GraduationCap, Megaphone, PartyPopper } from "lucide-react";
import { formatDateIn } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { SectionCard } from "./section-card";

export interface Announcement {
  id: string;
  kind: "exam" | "holiday";
  title: string;
  date: Date;
}

/**
 * Prochains rendez-vous de l'école : débuts d'examens et jours fériés. Faute
 * de module d'annonces (bientôt disponible), ce sont les événements déjà
 * saisis dans l'application — jamais d'annonce inventée.
 */
export async function AnnouncementsCard({
  items,
  delay,
}: {
  items: Announcement[];
  delay?: number;
}) {
  const { t, locale } = await getTranslations();

  return (
    <SectionCard
      title={t("dashboard.latestAnnouncements")}
      icon={Megaphone}
      href="/directeur/annonces"
      linkLabel={t("dashboard.viewAll")}
      bodyClassName="px-0 pb-2"
      delay={delay}
    >
      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-foreground/50">
          {t("dashboard.noAnnouncements")}
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
              <span
                className={
                  item.kind === "exam"
                    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"
                    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500"
                }
              >
                {item.kind === "exam" ? (
                  <GraduationCap className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <PartyPopper className="h-5 w-5" strokeWidth={2} />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-foreground/50">
                  {formatDateIn(locale, item.date, { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
