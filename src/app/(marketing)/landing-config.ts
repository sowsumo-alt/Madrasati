/**
 * Coordonnées commerciales affichées sur la page de présentation.
 * Le numéro alimente les boutons « Demander une démo » (lien WhatsApp) et
 * le pied de page. Format international, sans espaces : indispensable pour
 * que wa.me ouvre la bonne conversation.
 */
export const CONTACT_PHONE = "+22231728417";
export const CONTACT_EMAIL = "contact@madrasati.mr";

export const DEMO_MESSAGE =
  "Bonjour, je dirige une école et je souhaite une démonstration de Madrasati.";

// ---------------------------------------------------------------------------
// Tarification
//
// MONTANTS INDICATIFS — à valider avant mise en ligne. Le prix est calculé au
// nombre d'élèves, par paliers dégressifs (comme une tranche d'impôt : les 100
// premiers élèves sont facturés au tarif du premier palier, les suivants au
// tarif du palier suivant, etc.). Plus l'école est grande, moins l'élève coûte.
// ---------------------------------------------------------------------------

export interface PricingTier {
  /** Dernier élève couvert par ce palier. */
  upTo: number;
  /** Prix mensuel par élève, en MRU. */
  perStudent: number;
}

export const PRICING_TIERS: PricingTier[] = [
  { upTo: 100, perStudent: 40 },
  { upTo: 300, perStudent: 30 },
  { upTo: 600, perStudent: 22 },
  { upTo: Number.POSITIVE_INFINITY, perStudent: 15 },
];

/** Plancher de facturation : en dessous, une école paie ce montant. */
export const MIN_MONTHLY_MRU = 3500;

/** Mois offerts quand l'école règle l'année entière. */
export const ANNUAL_FREE_MONTHS = 2;

export const STUDENTS_MIN = 30;
export const STUDENTS_MAX = 2000;
export const STUDENTS_STEP = 10;
export const STUDENTS_DEFAULT = 250;

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  /** Coefficient appliqué au prix de base calculé au nombre d'élèves. */
  multiplier: number;
  features: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    tagline: "Pour démarrer sereinement",
    multiplier: 0.7,
    features: [
      "Élèves, parents et classes",
      "Présences et emploi du temps",
      "Frais et paiements en MRU",
      "1 compte directeur + 5 enseignants",
      "Support par WhatsApp",
    ],
  },
  {
    id: "ecole",
    name: "École",
    tagline: "Le choix de la plupart des écoles",
    multiplier: 1,
    popular: true,
    features: [
      "Tout l'Essentiel, sans limite de comptes",
      "Examens, notes et bulletins imprimables",
      "Espace parent pour chaque famille",
      "Messages WhatsApp aux parents",
      "Statistiques et appréciations assistées par IA",
    ],
  },
  {
    id: "reseau",
    name: "Réseau",
    tagline: "Pour plusieurs établissements",
    multiplier: 1.35,
    features: [
      "Tout le plan École, sur plusieurs écoles",
      "Vue consolidée du réseau",
      "Import de vos données existantes",
      "Formation de vos équipes sur place",
      "Support prioritaire, réponse sous 4 h",
    ],
  },
];

/**
 * Prix mensuel d'une école, en MRU, arrondi à la centaine.
 * Le calcul est volontairement pur : la page de tarifs le rejoue à chaque
 * mouvement du curseur, côté navigateur.
 */
export function monthlyPrice(students: number, multiplier = 1) {
  let remaining = Math.max(0, students);
  let previousCap = 0;
  let total = 0;

  for (const tier of PRICING_TIERS) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, tier.upTo - previousCap);
    total += slice * tier.perStudent;
    remaining -= slice;
    previousCap = tier.upTo;
  }

  const withPlan = Math.max(total * multiplier, MIN_MONTHLY_MRU);
  return Math.round(withPlan / 100) * 100;
}

/** Prix annuel : 12 mois d'usage, facturés {12 - ANNUAL_FREE_MONTHS}. */
export function yearlyPrice(students: number, multiplier = 1) {
  return monthlyPrice(students, multiplier) * (12 - ANNUAL_FREE_MONTHS);
}
