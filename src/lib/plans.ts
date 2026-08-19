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

/**
 * Tarifs officiels, à l'élève et au mois. Source unique : le tableau
 * comparatif des formules, le montant dû par école et le revenu mensuel du
 * tableau de bord Super Admin en découlent tous (voir computeMonthlyDue), et
 * aucun montant n'est figé en base — changer un prix ici suffit à mettre
 * l'application entière à jour, y compris pour les écoles déjà inscrites.
 */
export const PLAN_PRICE: Record<Plan, { amountPerStudent: number | null; label: string }> = {
  standard: { amountPerStudent: 25, label: "25 MRU / élève / mois" },
  advanced: { amountPerStudent: 35, label: "35 MRU / élève / mois" },
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
  "pending",
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
  pending: "En attente d'activation",
  trial: "En période d'essai",
  active: "Actif",
  past_due: "En retard",
  restricted: "Restreint",
  suspended: "Suspendu",
};

/**
 * Statut d'une école qui vient de s'inscrire : le compte existe, mais aucun
 * accès n'est ouvert tant que l'éditeur ne l'a pas activée depuis le tableau
 * de bord Super Admin. Distinct de « suspended », qui désigne une école qui
 * avait l'accès et l'a perdu faute de paiement — le message affiché n'a rien
 * à voir.
 */
export const INITIAL_SUBSCRIPTION_STATUS: SubscriptionStatus = "pending";

/**
 * Formule attribuée à une école dès sa création : l'Avancé, pour qu'elle
 * découvre toutes les fonctionnalités pendant son essai sans avoir rien à
 * choisir ni configurer. Le plan reste inscrit tel quel après l'essai ; c'est
 * le passage en « restricted » qui la ramène aux fonctionnalités Standard
 * (voir effectivePlan) tant qu'aucune formule payante n'est confirmée.
 */
export const INITIAL_PLAN: Plan = "advanced";

/** L'école n'a aucun accès à l'application tant qu'elle est dans cet état. */
export function blocksAllAccess(status: string): boolean {
  return status === "pending" || status === "suspended";
}

/** Statuts pour lesquels l'école doit de l'argent : ils appellent une relance,
 *  et c'est pour eux que le retard d'échéance est pertinent. */
export const OWING_STATUSES: readonly SubscriptionStatus[] = [
  "past_due",
  "restricted",
  "suspended",
];

export function isOwingStatus(status: SubscriptionStatus): boolean {
  return OWING_STATUSES.includes(status);
}

/** Durée d'un cycle de facturation, en jours — la prochaine échéance est
 *  fixée à cette distance après chaque paiement encaissé (voir markAsPaid). */
export const BILLING_CYCLE_DAYS = 30;

/** Durée de la période d'essai gratuite, en jours. Le compte à rebours démarre
 *  au moment où l'éditeur active l'école (passage au statut « trial » depuis le
 *  tableau de bord Super Admin), pas à son inscription : entre les deux, elle
 *  n'a aucun accès et ne consommerait donc que des jours perdus. */
export const TRIAL_DAYS = 15;

/** Nombre de jours avant la fin de l'essai à partir duquel on relance l'école. */
export const TRIAL_REMINDER_DAYS = 3;

/** Fin de la période d'essai : l'échéance fixée à l'activation si elle existe,
 *  sinon TRIAL_DAYS après la création de l'école (école activée avant que
 *  l'échéance ne soit posée automatiquement). */
export function trialEndsAt(school: { createdAt: Date; nextDueAt: Date | null }): Date {
  if (school.nextDueAt) return school.nextDueAt;
  const end = new Date(school.createdAt);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

/** Nombre de jours entiers écoulés entre deux dates (négatif si `to` précède
 *  `from`). Calculé sur les dates civiles, pas à l'heure près : « 3 jours de
 *  retard » doit vouloir dire la même chose quelle que soit l'heure de la
 *  consultation. */
export function daysBetween(from: Date, to: Date): number {
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}

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

/**
 * Cette école a-t-elle droit à cette fonctionnalité, statut de facturation
 * compris ?
 *
 * À préférer systématiquement à `planHasFeature(school.plan, …)` : partir du
 * plan brut ignore le statut « restricted », et une école dont l'essai est
 * terminé continuait alors de voir ses bandeaux, ses entrées de menu et ses
 * messages bilingues — jusqu'à ce qu'un clic la renvoie sur l'écran
 * « fonctionnalité verrouillée », seul endroit qui appliquait vraiment la
 * règle. La restriction n'a de sens que si elle est visible partout.
 */
export function schoolHasFeature(
  school: { plan: string; subscriptionStatus: string } | null | undefined,
  feature: Feature,
): boolean {
  if (!school) return false;
  return planHasFeature(effectivePlan(school), feature);
}

/** Montant dû ce mois-ci pour une école, arrondi à l'unité. `null` pour le
 *  plan Réseau (sur devis, pas de formule fixe). */
export function computeMonthlyDue(plan: string, activeStudentCount: number): number | null {
  const normalized = isPlan(plan) ? plan : "standard";
  const amountPerStudent = PLAN_PRICE[normalized].amountPerStudent;
  if (amountPerStudent == null) return null;
  return amountPerStudent * activeStudentCount;
}
