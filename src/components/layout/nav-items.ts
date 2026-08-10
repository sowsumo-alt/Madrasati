import type { TranslationKey } from "@/lib/i18n/dictionaries";
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
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
}

const directorNavItems: NavItem[] = [
  { href: "/directeur", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/directeur/eleves", labelKey: "nav.students", icon: Users },
  { href: "/directeur/enseignants", labelKey: "nav.teachers", icon: BookUser },
  { href: "/directeur/parents", labelKey: "nav.parents", icon: Contact },
  { href: "/directeur/classes", labelKey: "nav.classes", icon: School },
  { href: "/directeur/emploi-du-temps", labelKey: "nav.schedule", icon: CalendarDays },
  { href: "/directeur/presences", labelKey: "nav.attendance", icon: ClipboardCheck },
  { href: "/directeur/examens", labelKey: "nav.exams", icon: GraduationCap },
  { href: "/directeur/bulletins", labelKey: "nav.reportCards", icon: FileText },
  { href: "/directeur/finance", labelKey: "nav.finance", icon: Wallet },
  { href: "/directeur/communication", labelKey: "nav.communication", icon: MessageCircle },
  { href: "/directeur/statistiques", labelKey: "nav.statistics", icon: BarChart3 },
];

// Les composants d'icônes (fonctions React) ne peuvent pas traverser la
// frontière serveur -> client en tant que prop. AppShell (un composant
// client) sélectionne donc ce tableau localement via une clé simple
// (string, sérialisable), plutôt que de le recevoir en prop depuis un
// layout serveur.
export const navItemsByRole = {
  director: directorNavItems,
} as const;

export type NavKey = keyof typeof navItemsByRole;
