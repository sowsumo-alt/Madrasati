import {
  BarChart3,
  Bell,
  Building2,
  CirclePlus,
  CreditCard,
  Crown,
  FileText,
  Home,
  Settings,
  Stamp,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Menu de l'espace Super Admin, dans l'ordre de la maquette. Une entrée
 * « bientôt » n'est pas un lien : la page n'existe pas encore, on ne fait
 * pas semblant. Les sous-entrées ouvrent le tableau des écoles déjà filtré.
 */
export interface SaNavLink {
  label: string;
  href: string;
  /** Filtre de statut ouvert par ce lien (pour marquer l'entrée active). */
  statut?: string;
}

export interface SaNavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: SaNavLink[];
  soon?: boolean;
}

export interface SaNavGroup {
  label?: string;
  items: SaNavItem[];
}

export const SA_NAV: SaNavGroup[] = [
  { items: [{ label: "Tableau de bord", icon: Home, href: "/super-admin" }] },
  {
    label: "Gestion",
    items: [
      { label: "Écoles", icon: Building2, href: "/super-admin#ecoles" },
      {
        label: "Nouvelles écoles",
        icon: CirclePlus,
        children: [
          { label: "En attente d'activation", href: "/super-admin?statut=pending#ecoles", statut: "pending" },
          { label: "En période d'essai", href: "/super-admin?statut=trial#ecoles", statut: "trial" },
        ],
      },
      { label: "Utilisateurs", icon: Users, soon: true },
      {
        label: "Paiements",
        icon: CreditCard,
        children: [
          { label: "Revenus encaissés", href: "/super-admin#revenus" },
          { label: "Écoles en retard", href: "/super-admin?statut=past_due#ecoles", statut: "past_due" },
        ],
      },
      { label: "Évaluations", icon: BarChart3, soon: true },
      { label: "Rapports", icon: FileText, soon: true },
    ],
  },
  {
    label: "Paramètres",
    items: [
      { label: "Paramètres généraux", icon: Settings, soon: true },
      { label: "Bloc officiel des bulletins", icon: Stamp, href: "/super-admin/en-tete-officiel" },
      { label: "Plan d'abonnement", icon: Crown, soon: true },
      { label: "Notifications", icon: Bell, soon: true },
    ],
  },
];
