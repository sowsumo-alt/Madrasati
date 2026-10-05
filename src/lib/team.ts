/**
 * Les directeurs d'une école : le directeur principal (celui qui l'a créée)
 * et ses associés, chacun avec son propre identifiant et son mot de passe.
 * Une école = un seul espace de données : tous voient les mêmes élèves, les
 * mêmes familles, le même argent.
 *
 * Sans dépendance à la base : testé à part (tests/team.test.ts).
 */

export const DIRECTOR_ACCESS = ["FULL", "READ_ONLY"] as const;
export type DirectorAccess = (typeof DIRECTOR_ACCESS)[number];

export const ACCESS_LABELS: Record<DirectorAccess, string> = {
  FULL: "Directeur",
  READ_ONLY: "Lecture seule",
};

export function accessLabel(account: { isOwner: boolean; access: string }) {
  if (account.isOwner) return "Directeur principal";
  return account.access === "READ_ONLY" ? ACCESS_LABELS.READ_ONLY : ACCESS_LABELS.FULL;
}

interface Account {
  id: string;
  schoolId: string;
  role: string;
  isOwner: boolean;
}

/**
 * Pourquoi `actor` ne peut pas gérer le compte `target` (rôle, mot de passe,
 * accès) ; null s'il le peut. Seul le directeur principal gère les autres
 * directeurs, et personne ne touche au directeur principal ni à son propre
 * compte par ce biais (« Mon compte » est fait pour ça).
 */
export function teamRefusal(actor: Account, target: Account | null): string | null {
  if (!target || target.schoolId !== actor.schoolId) return "Compte introuvable.";
  if (target.id === actor.id) return "Pour votre propre compte, utilisez la page « Mon compte ».";
  if (target.role !== "DIRECTOR") return null; // enseignants et parents : tout directeur les gère
  if (!actor.isOwner) return "Seul le directeur principal peut gérer les autres directeurs.";
  if (target.isOwner) return "Le compte du directeur principal ne peut pas être modifié ici.";
  return null;
}

/** Une adresse e-mail plausible, en minuscules ; null si elle ne l'est pas. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}
