import type { TranslationKey } from "@/lib/i18n/dictionaries";
import type { Feature } from "@/lib/plans";
import {
  LayoutDashboard,
  Users,
  Wallet,
  BookUser,
  Contact,
  School,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  FileText,
  MessageCircle,
  BarChart3,
  Settings,
  UserPlus,
  ClipboardPlus,
  ShieldAlert,
  Briefcase,
  UserSearch,
  HandCoins,
  FileChartColumn,
  Bell,
  UserCog,
  CalendarRange,
  NotebookPen,
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  /** Fonctionnalité du plan requise — absent si incluse dans toutes les formules. */
  feature?: Feature;
  /** Annoncée mais pas encore développée : mène à une page « Bientôt disponible ». */
  soon?: boolean;
}

export interface NavGroup {
  /** Sans titre si absent (ex: le Tableau de bord, toujours seul en tête). */
  labelKey?: TranslationKey;
  items: NavItem[];
}

// Menu de la maquette de septembre 2026. Enseignants, RH et Statistiques n'y
// figuraient pas : ils restent sous Administration, pour qu'aucune page qui
// fonctionne ne disparaisse du menu.
const directorNavGroups: NavGroup[] = [
  {
    items: [{ href: "/directeur", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "nav.category.schooling",
    items: [
      { href: "/directeur/inscription", labelKey: "nav.enrollment", icon: ClipboardPlus },
      { href: "/directeur/eleves", labelKey: "nav.students", icon: Users },
      { href: "/directeur/classes", labelKey: "nav.classes", icon: School },
      { href: "/directeur/reinscription", labelKey: "nav.reenrollment", icon: UserPlus },
    ],
  },
  {
    labelKey: "nav.category.pedagogy",
    items: [
      { href: "/directeur/emploi-du-temps", labelKey: "nav.schedule", icon: CalendarDays },
      { href: "/directeur/presences", labelKey: "nav.attendance", icon: ClipboardCheck },
      { href: "/directeur/examens", labelKey: "nav.exams", icon: GraduationCap },
      { href: "/directeur/notes", labelKey: "nav.grades", icon: NotebookPen },
      { href: "/directeur/bulletins", labelKey: "nav.reportCards", icon: FileText },
      { href: "/directeur/discipline", labelKey: "nav.discipline", icon: ShieldAlert },
      {
        href: "/directeur/eleves-a-surveiller",
        labelKey: "nav.atRisk",
        icon: UserSearch,
        feature: "atRiskDetection",
      },
    ],
  },
  {
    labelKey: "nav.category.finance",
    items: [
      { href: "/directeur/finance", labelKey: "nav.payments", icon: Wallet },
      // Même écran que Paiements, ouvert directement sur les frais non soldés.
      { href: "/directeur/finance?statut=impayes", labelKey: "nav.unpaid", icon: HandCoins },
      {
        href: "/directeur/rapports-financiers",
        labelKey: "nav.financialReports",
        icon: FileChartColumn,
        soon: true,
      },
    ],
  },
  {
    labelKey: "nav.category.communication",
    items: [
      { href: "/directeur/communication", labelKey: "nav.messages", icon: MessageCircle },
      { href: "/directeur/parents", labelKey: "nav.parents", icon: Contact },
      { href: "/directeur/notifications", labelKey: "nav.notifications", icon: Bell, soon: true },
    ],
  },
  {
    labelKey: "nav.category.admin",
    items: [
      { href: "/directeur/enseignants", labelKey: "nav.teachers", icon: BookUser },
      { href: "/directeur/rh", labelKey: "nav.hr", icon: Briefcase, feature: "hrPayroll" },
      { href: "/directeur/utilisateurs", labelKey: "nav.users", icon: UserCog, soon: true },
      {
        href: "/directeur/statistiques",
        labelKey: "nav.statistics",
        icon: BarChart3,
        feature: "advancedStats",
      },
      { href: "/directeur/parametres", labelKey: "nav.settings", icon: Settings },
      // Les années scolaires se gèrent dans une section de Paramètres.
      { href: "/directeur/parametres#annees", labelKey: "nav.schoolYear", icon: CalendarRange },
    ],
  },
];

const teacherNavGroups: NavGroup[] = [
  {
    items: [
      { href: "/enseignant", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { href: "/enseignant/presences", labelKey: "nav.attendance", icon: ClipboardCheck },
      { href: "/enseignant/notes", labelKey: "nav.exams", icon: GraduationCap },
      { href: "/enseignant/saisie-notes", labelKey: "nav.grades", icon: NotebookPen },
      { href: "/enseignant/emploi-du-temps", labelKey: "nav.schedule", icon: CalendarDays },
      {
        href: "/enseignant/eleves-a-surveiller",
        labelKey: "nav.atRisk",
        icon: UserSearch,
        feature: "atRiskDetection",
      },
    ],
  },
];

const parentNavGroups: NavGroup[] = [
  {
    items: [{ href: "/parent", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
];

// Les composants d'icônes (fonctions React) ne peuvent pas traverser la
// frontière serveur -> client en tant que prop. AppShell (un composant
// client) sélectionne donc ce tableau localement via une clé simple
// (string, sérialisable), plutôt que de le recevoir en prop depuis un
// layout serveur.
export const navGroupsByRole = {
  director: directorNavGroups,
  teacher: teacherNavGroups,
  parent: parentNavGroups,
} as const;

export type NavKey = keyof typeof navGroupsByRole;
