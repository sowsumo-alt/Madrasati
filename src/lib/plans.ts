/**
 * Formules d'abonnement Madrasati. Chaque école a un plan (School.plan,
 * "standard" par défaut) qui détermine les fonctionnalités auxquelles elle a
 * droit — comme Netflix Basique / Standard / Premium.
 *
 * Certaines fonctionnalités listées ici (HR_PAYROLL, SCHOOL_LIFE,
 * AT_RISK_DETECTION, MULTI_SCHOOL) ne sont pas encore construites dans
 * l'application : elles existent dans PLAN_FEATURES pour que le tableau
 * comparatif des formules (paramètres > Changer de formule) les annonce
 * correctement, mais IS_FEATURE_LIVE indique qu'il n'y a pas encore de page
 * réelle à verrouiller pour elles.
 */

export const PLANS = ["standard", "advanced", "network"] as const;
export type Plan = (typeof PLANS)[number];

export function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

export const PLAN_LABELS: Record<Plan, string> = {
  standard: "Standard",
  advanced: "Avancé",
  network: "Réseau",
};

export const PLAN_PRICE: Record<Plan, { amountPerStudent: number | null; label: string }> = {
  standard: { amountPerStudent: 100, label: "100 MRU / élève / mois" },
  advanced: { amountPerStudent: 150, label: "150 MRU / élève / mois" },
  network: { amountPerStudent: null, label: "Sur devis" },
};

export const FEATURES = {
  PARENT_PORTAL: "parentPortal",
  ADVANCED_STATS: "advancedStats",
  BILINGUAL_MESSAGES: "bilingualMessages",
  HR_PAYROLL: "hrPayroll",
  SCHOOL_LIFE: "schoolLife",
  AT_RISK_DETECTION: "atRiskDetection",
  MULTI_SCHOOL: "multiSchool",
} as const;
export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

/** Fonctionnalités déjà construites dans l'application (voir audit du 16/08). */
export const IS_FEATURE_LIVE: Record<Feature, boolean> = {
  [FEATURES.PARENT_PORTAL]: true,
  [FEATURES.ADVANCED_STATS]: true,
  [FEATURES.BILINGUAL_MESSAGES]: true,
  [FEATURES.HR_PAYROLL]: true,
  [FEATURES.SCHOOL_LIFE]: false,
  [FEATURES.AT_RISK_DETECTION]: true,
  [FEATURES.MULTI_SCHOOL]: false,
};

export interface FeatureInfo {
  feature: Feature;
  label: string;
}

const ADVANCED_ONLY_FEATURES: FeatureInfo[] = [
  { feature: FEATURES.PARENT_PORTAL, label: "Portail parents dédié" },
  { feature: FEATURES.HR_PAYROLL, label: "RH et paie des enseignants" },
  { feature: FEATURES.ADVANCED_STATS, label: "Statistiques et tableaux de bord avancés" },
  { feature: FEATURES.BILINGUAL_MESSAGES, label: "Messages WhatsApp bilingues (français/arabe)" },
  { feature: FEATURES.SCHOOL_LIFE, label: "Vie scolaire (bibliothèque, infirmerie, transport)" },
  { feature: FEATURES.AT_RISK_DETECTION, label: "Détection des élèves en difficulté" },
];

const NETWORK_ONLY_FEATURES: FeatureInfo[] = [
  { feature: FEATURES.MULTI_SCHOOL, label: "Gestion de plusieurs établissements + tableau consolidé" },
];

/** Fonctionnalités de base, incluses dans toutes les formules (pour l'affichage du comparatif). */
export const STANDARD_FEATURES = [
  "Élèves, classes, matières",
  "Notes et moyennes",
  "Présences (appel quotidien)",
  "Finance (frais, paiements, reçus)",
  "Relances WhatsApp de base",
  "Bulletins automatiques (français)",
  "Emploi du temps",
];

export const PLAN_FEATURE_LIST: Record<Plan, FeatureInfo[]> = {
  standard: [],
  advanced: ADVANCED_ONLY_FEATURES,
  network: [...ADVANCED_ONLY_FEATURES, ...NETWORK_ONLY_FEATURES],
};

const PLAN_FEATURE_SET: Record<Plan, Set<Feature>> = {
  standard: new Set(),
  advanced: new Set(ADVANCED_ONLY_FEATURES.map((f) => f.feature)),
  network: new Set([...ADVANCED_ONLY_FEATURES, ...NETWORK_ONLY_FEATURES].map((f) => f.feature)),
};

/** Vérification centralisée : ce plan donne-t-il droit à cette fonctionnalité ? */
export function planHasFeature(plan: string | null | undefined, feature: Feature): boolean {
  const normalized = plan && isPlan(plan) ? plan : "standard";
  return PLAN_FEATURE_SET[normalized].has(feature);
}

// ---------------------------------------------------------------------------
// Statut de facturation — géré depuis le tableau de bord Super Admin.
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_STATUSES = [
  "trial",
  "active",
  "past_due",
  "restricted",
  "suspended",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "En période d'essai",
  active: "Actif",
  past_due: "En retard",
  restricted: "Restreint",
  suspended: "Suspendu",
};

/**
 * Plan réellement accordé compte tenu du statut de facturation : un compte
 * "restricted" retombe sur les fonctionnalités Standard (ses fonctionnalités
 * payantes se reverrouillent) même s'il reste sur le papier en Avancé/Réseau
 * — le plan d'origine n'est jamais effacé, il redevient actif dès que le
 * statut repasse à "active" (bouton « Marquer comme payé »).
 */
export function effectivePlan(school: { plan: string; subscriptionStatus: string }): Plan {
  if (school.subscriptionStatus === "restricted") return "standard";
  return isPlan(school.plan) ? school.plan : "standard";
}

/** Montant dû ce mois-ci pour une école, arrondi à l'unité. `null` pour le
 *  plan Réseau (sur devis, pas de formule fixe). */
export function computeMonthlyDue(plan: string, activeStudentCount: number): number | null {
  const normalized = isPlan(plan) ? plan : "standard";
  const amountPerStudent = PLAN_PRICE[normalized].amountPerStudent;
  if (amountPerStudent == null) return null;
  return amountPerStudent * activeStudentCount;
}
