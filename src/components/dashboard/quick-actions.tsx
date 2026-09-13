import Link from "next/link";
import { BookUser, CalendarPlus, School, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslations } from "@/lib/i18n/server";

interface QuickAction {
  href: string;
  label: string;
  icon: LucideIcon;
  tile: string;
  badge: string;
}

/** Les quatre gestes les plus fréquents du directeur, à un clic de l'accueil. */
export async function QuickActions() {
  const { t } = await getTranslations();

  const actions: QuickAction[] = [
    {
      // Ouvre directement le formulaire d'inscription (voir la page Élèves).
      href: "/directeur/eleves?new=1",
      label: t("dashboard.newStudent"),
      icon: UserPlus,
      tile: "bg-primary-700 text-white hover:bg-primary-800",
      badge: "bg-white/15 text-white",
    },
    {
      href: "/directeur/enseignants",
      label: t("dashboard.addTeacher"),
      icon: BookUser,
      tile: "bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
      badge: "bg-white text-emerald-600",
    },
    {
      href: "/directeur/classes",
      label: t("dashboard.createClass"),
      icon: School,
      tile: "bg-blue-50 text-blue-950 hover:bg-blue-100",
      badge: "bg-white text-blue-600",
    },
    {
      href: "/directeur/emploi-du-temps",
      label: t("dashboard.planLesson"),
      icon: CalendarPlus,
      tile: "bg-violet-50 text-violet-950 hover:bg-violet-100",
      badge: "bg-white text-violet-600",
    },
  ];

  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {actions.map(({ href, label, icon: Icon, tile, badge }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl px-2 py-4 text-center text-xs font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
            tile,
          )}
        >
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", badge)}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          {label}
        </Link>
      ))}
    </div>
  );
}
