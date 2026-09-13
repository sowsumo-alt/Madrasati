import { BookOpen, CalendarClock, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslations } from "@/lib/i18n/server";
import { SectionCard } from "./section-card";

export interface UpcomingActivity {
  id: string;
  kind: "lesson" | "exam";
  /** « 08:00 – 09:00 » pour un cours du jour, la date pour un examen. */
  when: string;
  subject: string;
  title: string;
  className: string;
  teacher: string | null;
}

const SUBJECT_TONES = [
  "bg-emerald-50 text-emerald-700",
  "bg-violet-50 text-violet-700",
  "bg-blue-50 text-blue-700",
  "bg-orange-50 text-orange-700",
  "bg-cyan-50 text-cyan-700",
  "bg-pink-50 text-pink-700",
];

/**
 * Couleur stable d'une matière, tirée de son nom : la même d'un jour à l'autre
 * et d'une ligne à l'autre, sans table de correspondance à tenir à jour.
 */
function subjectTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_TONES[hash % SUBJECT_TONES.length];
}

/** Cours restants de la journée, puis examens des deux prochaines semaines. */
export async function UpcomingActivitiesCard({
  items,
  delay,
}: {
  items: UpcomingActivity[];
  delay?: number;
}) {
  const { t } = await getTranslations();

  return (
    <SectionCard
      title={t("dashboard.upcomingActivities")}
      icon={CalendarClock}
      href="/directeur/emploi-du-temps"
      linkLabel={t("dashboard.viewAll")}
      bodyClassName="px-0 pb-3"
      delay={delay}
    >
      {items.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-foreground/50">
          {t("dashboard.noUpcomingActivities")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="bg-surface-muted/70 text-xs text-foreground/55">
                <th className="px-5 py-2.5 text-start font-medium">{t("dashboard.colTime")}</th>
                <th className="px-3 py-2.5 text-start font-medium">{t("dashboard.colType")}</th>
                <th className="px-3 py-2.5 text-start font-medium">{t("dashboard.colTitle")}</th>
                <th className="px-3 py-2.5 text-start font-medium">{t("dashboard.colClass")}</th>
                <th className="px-5 py-2.5 text-start font-medium">{t("dashboard.colTeacher")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {items.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-surface-muted/40">
                  <td
                    className="whitespace-nowrap px-5 py-3 text-foreground/80"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {a.when}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex max-w-[11rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                        subjectTone(a.subject),
                      )}
                    >
                      {a.kind === "exam" ? (
                        <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{a.subject}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-foreground/80">{a.title}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-foreground/70">{a.className}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-foreground/70">
                    {a.teacher ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
