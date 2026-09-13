import {
  ClipboardCheck,
  GraduationCap,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { formatEventTime } from "@/lib/format";
import { getTranslations } from "@/lib/i18n/server";
import { SectionCard } from "./section-card";

export type ActivityKind = "student" | "payment" | "attendance" | "exam";

export interface ActivityEntry {
  at: Date;
  kind: ActivityKind;
  title: string;
  detail: string;
}

const KIND_STYLE: Record<ActivityKind, { icon: LucideIcon; badge: string }> = {
  student: { icon: UserPlus, badge: "bg-emerald-50 text-emerald-600" },
  payment: { icon: Wallet, badge: "bg-amber-50 text-amber-600" },
  attendance: { icon: ClipboardCheck, badge: "bg-blue-50 text-blue-600" },
  exam: { icon: GraduationCap, badge: "bg-violet-50 text-violet-600" },
};

/** Derniers événements de l'école : inscriptions, paiements, appels, examens. */
export async function RecentActivityCard({
  items,
  delay,
}: {
  items: ActivityEntry[];
  delay?: number;
}) {
  const { t } = await getTranslations();

  return (
    <SectionCard
      title={t("dashboard.recentActivity")}
      href="/directeur/activite"
      linkLabel={t("dashboard.viewAll")}
      bodyClassName="px-0 pb-2"
      delay={delay}
    >
      {items.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-foreground/50">
          {t("dashboard.nothingToReport")}
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {items.map((item, i) => {
            const { icon: Icon, badge } = KIND_STYLE[item.kind];
            return (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${badge}`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="truncate text-xs text-foreground/55">{item.detail}</p>
                </div>
                <span
                  className="shrink-0 self-start pt-0.5 text-xs text-foreground/40"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatEventTime(item.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
