import { BookOpen, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

type Tone = "green" | "blue" | "amber" | "violet";

const TONES: Record<Tone, { tile: string; icon: string; value: string; label: string }> = {
  green: {
    tile: "bg-primary-50/80",
    icon: "bg-primary-100/70 text-primary-600",
    value: "text-primary-900",
    label: "text-primary-900/65",
  },
  blue: {
    tile: "bg-sky-50",
    icon: "bg-sky-100/70 text-sky-600",
    value: "text-sky-950",
    label: "text-slate-600",
  },
  amber: {
    tile: "bg-amber-50/80",
    icon: "bg-amber-100/50 text-amber-500",
    value: "text-amber-950",
    label: "text-stone-500",
  },
  violet: {
    tile: "bg-violet-50/80",
    icon: "bg-violet-100/70 text-violet-600",
    value: "text-violet-950",
    label: "text-violet-900/60",
  },
};

export interface ClassesKpisValues {
  classes: number;
  students: number;
  mainTeachers: number;
  subjects: number;
}

const ITEMS: { key: keyof ClassesKpisValues; label: TranslationKey; icon: LucideIcon; tone: Tone }[] = [
  { key: "classes", label: "classes.kpiClasses", icon: UsersRound, tone: "green" },
  { key: "students", label: "classes.kpiStudents", icon: UserRound, tone: "blue" },
  { key: "mainTeachers", label: "classes.kpiMainTeachers", icon: UserRound, tone: "amber" },
  { key: "subjects", label: "classes.kpiSubjects", icon: BookOpen, tone: "violet" },
];

/** Les quatre chiffres d'en-tête de la page Classes, chacun dans sa teinte. */
export function ClassesKpis({ values }: { values: ClassesKpisValues }) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
      {ITEMS.map(({ key, label, icon: Icon, tone }) => {
        const style = TONES[tone];
        return (
          <div key={key} className={cn("flex min-w-0 items-center gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4", style.tile)}>
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12",
                style.icon,
              )}
            >
              <Icon
                className="h-6 w-6"
                strokeWidth={2}
                fill={tone === "green" ? "currentColor" : "none"}
              />
            </span>
            <div className="min-w-0">
              <p className={cn("text-2xl font-bold leading-tight", style.value)}>{values[key]}</p>
              <p className={cn("truncate text-sm", style.label)}>{t(label)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
