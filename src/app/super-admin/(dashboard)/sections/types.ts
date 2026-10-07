import type { Plan, SubscriptionStatus } from "@/lib/plans";
import type { RevenuePeriod } from "@/lib/super-admin-stats";

/** Une école cliente, telle que l'affiche le tableau (calculée côté serveur, voir page.tsx). */
export interface SchoolRow {
  id: string;
  /** « #E001 » : rang d'inscription sur la plateforme. */
  code: string;
  name: string;
  city: string | null;
  studentCount: number;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  lastPaymentAt: string | null;
  nextDueAt: string | null;
  amountDue: number | null;
  directorName: string | null;
  directorPhone: string | null;
  createdAt: string;
  daysLate: number | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
}

export interface DashboardKpis {
  totalSchools: number;
  newThisWeek: number;
  newThisMonth: number;
  /** Nombre d'écoles à la fin de chacun des 6 derniers mois. */
  schoolsTrend: number[];
  /** Écoles inscrites chacun des 6 derniers mois. */
  newTrend: number[];
  revenueThisMonth: number;
  /** % par rapport au mois précédent ; null sans base de comparaison. */
  revenueChange: number | null;
  revenueTrend: number[];
  late: number;
  maxDaysLate: number | null;
  pending: number;
}

export interface ActivityItem {
  id: string;
  kind: "school" | "pending" | "payment";
  title: string;
  detail: string;
  /** « il y a 2 h », calculé par le serveur. */
  when: string;
}

export interface DashboardData {
  todayLabel: string;
  kpis: DashboardKpis;
  revenue: {
    periods: Record<6 | 12, RevenuePeriod>;
    thisMonth: number;
    /** Ce que rapportent chaque mois les écoles actives (formule × élèves). */
    expectedMonthly: number;
  };
  activity: ActivityItem[];
  schools: SchoolRow[];
}
