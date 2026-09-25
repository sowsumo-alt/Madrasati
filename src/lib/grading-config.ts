import { z } from "zod";
import { EXAM_KINDS, type ExamKind } from "@/lib/exams";
import { roundHundredth } from "@/lib/grading";

/**
 * Règle de calcul des moyennes d'une école.
 *
 * Aucune formule n'est écrite en dur : chaque école décrit la sienne — ses
 * types de notes, leur poids, ce qu'on fait quand il y en a plusieurs du même
 * type, et par combien on divise. Le modèle livré par défaut est celui du
 * bulletin officiel relevé à l'École Ngalam (meilleur devoir × 3 +
 * composition, ÷ 4), mais une école qui compte autrement le remplace sans
 * toucher à celle d'à côté : la configuration est enregistrée par école
 * (table grading_configs) et le moteur la relit avant chaque calcul.
 *
 * Deux règles distinctes cohabitent, parce que les deux cycles ne comptent
 * pas pareil : celle du collège et du lycée, celle du Fondamental.
 *
 * Sans dépendance à la base ni à React : testé à part
 * (tests/grading-config.test.ts).
 */

/** Ce qu'on fait quand un bloc reçoit plusieurs notes dans le trimestre. */
export const MULTI_RULES = ["BEST", "AVERAGE", "SUM", "LAST"] as const;
export type MultiRule = (typeof MULTI_RULES)[number];

export interface FormulaPart {
  /** Identifiant stable, pour retrouver le bloc d'une version à l'autre. */
  id: string;
  /** Nom du bloc pour le directeur : « Devoirs », « Composition »… */
  label: string;
  /** Types d'examens qui alimentent ce bloc ; vide = tous les types. */
  kinds: ExamKind[];
  /** Poids du bloc dans la moyenne de la matière (le « × 3 » des devoirs). */
  weight: number;
  /** Plusieurs notes dans ce bloc : la meilleure, la moyenne, la somme, la dernière. */
  multiple: MultiRule;
  /** Sans note dans ce bloc, la matière n'a pas de moyenne. */
  required: boolean;
  /** En-tête de la colonne sur le bulletin, si différent du nom du bloc. */
  columnLabel?: string;
  columnLabelAr?: string;
  /** Nom donné aux examens créés depuis la grille : « Devoir 3 ». */
  examTitle?: string;
  /**
   * Bulletin annuel seulement : le trimestre dont les notes nourrissent ce
   * bloc (« Composition du Trimestre 2 »). Absent : toute l'année — c'est
   * ainsi que le meilleur devoir est cherché parmi les trois trimestres.
   */
  term?: string;
}

export interface Formula {
  parts: FormulaPart[];
  /**
   * Diviseur de la moyenne : « AUTO » additionne les poids des blocs utilisés
   * (3 + 1 = 4 chez Ngalam), « FIXED » impose un nombre choisi par l'école.
   */
  divisor: { mode: "AUTO" } | { mode: "FIXED"; value: number };
}

/**
 * Bulletin annuel récapitulatif : ses propres formules (une par cycle), qui
 * puisent dans les notes des trois trimestres, et le seuil de passage qui
 * sert à suggérer — jamais imposer — la décision de fin d'année.
 */
export interface AnnualConfig {
  enabled: boolean;
  secondary: Formula;
  fundamental: Formula;
  /** Moyenne annuelle à partir de laquelle le passage est suggéré. */
  passThreshold: number;
}

export interface GradingConfig {
  version: 1;
  /** Collège et lycée (classes AS). */
  secondary: Formula;
  /** Fondamental (classes AF) et classes au niveau non reconnu. */
  fundamental: Formula;
  /** Bulletin annuel récapitulatif. */
  annual: AnnualConfig;
}

export const TERM_LABELS = ["Trimestre 1", "Trimestre 2", "Trimestre 3"] as const;

/** Blocs de notes qui ne sont pas la composition : devoirs, contrôles, interrogations. */
const DEVOIR_KINDS: ExamKind[] = ["DEVOIR", "CONTROLE", "INTERROGATION"];

/**
 * Modèle livré par défaut : le système confirmé par le directeur de l'École
 * Ngalam. Une école qui compte ainsi n'a rien à configurer ; les autres
 * modifient ce modèle, sans conséquence pour personne d'autre.
 */
export function defaultGradingConfig(): GradingConfig {
  return {
    version: 1,
    secondary: {
      parts: [
        {
          id: "devoir",
          label: "Devoirs",
          kinds: DEVOIR_KINDS,
          weight: 3,
          multiple: "BEST",
          required: true,
          columnLabel: "Moy Int × 3",
          columnLabelAr: "معدل فردي×3",
          examTitle: "Devoir",
        },
        {
          id: "composition",
          label: "Composition",
          kinds: ["COMPOSITION"],
          weight: 1,
          multiple: "LAST",
          required: true,
          columnLabel: "Compt",
          columnLabelAr: "التأليف",
          examTitle: "Composition",
        },
      ],
      divisor: { mode: "AUTO" },
    },
    // Le Fondamental garde le calcul d'origine de Madrasati — la moyenne
    // simple de toutes les notes de la matière — tant qu'un vrai bulletin du
    // primaire n'a pas été fourni. Exprimé ici comme une règle ordinaire, que
    // le directeur peut donc changer lui aussi.
    fundamental: {
      parts: [
        {
          id: "toutes",
          label: "Toutes les notes",
          kinds: [],
          weight: 1,
          multiple: "AVERAGE",
          required: true,
          examTitle: "Note",
        },
      ],
      divisor: { mode: "AUTO" },
    },
    annual: defaultAnnualConfig(),
  };
}

/**
 * Bulletin annuel du modèle officiel relevé à l'École Ngalam :
 * (meilleur devoir de l'année × 3 + composition T1 × 1 + composition T2 × 2
 * + composition T3 × 3) ÷ 9. Le poids des compositions grandit au fil de
 * l'année : c'est le niveau de fin d'année qui compte le plus.
 */
export function defaultAnnualConfig(): AnnualConfig {
  const compo = (term: (typeof TERM_LABELS)[number], index: number) => ({
    id: `composition-t${index + 1}`,
    label: `Composition ${term}`,
    kinds: ["COMPOSITION"] as ExamKind[],
    weight: index + 1,
    multiple: "LAST" as const,
    required: true,
    term,
    columnLabel: `Compo T${index + 1} ×${index + 1}`,
    columnLabelAr: `امتحان${index + 1}×${index + 1}`,
  });

  return {
    enabled: true,
    secondary: {
      parts: [
        {
          id: "devoir",
          label: "Meilleur devoir de l'année",
          kinds: DEVOIR_KINDS,
          weight: 3,
          multiple: "BEST",
          required: true,
          columnLabel: "Meilleur Devoir ×3",
          columnLabelAr: "أحسن فرض×3",
        },
        ...TERM_LABELS.map(compo),
      ],
      divisor: { mode: "AUTO" },
    },
    // Tant qu'aucun bulletin annuel du Fondamental n'a été fourni : la
    // moyenne simple de toutes les notes de l'année, comme au trimestre.
    fundamental: {
      parts: [
        {
          id: "toutes",
          label: "Toutes les notes de l'année",
          kinds: [],
          weight: 1,
          multiple: "AVERAGE",
          required: true,
        },
      ],
      divisor: { mode: "AUTO" },
    },
    passThreshold: 10,
  };
}

const divisorSchema = z.union([
  z.object({ mode: z.literal("AUTO") }),
  z.object({ mode: z.literal("FIXED"), value: z.number().positive().max(100) }),
]);

const partSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(60),
  kinds: z.array(z.enum(EXAM_KINDS)).max(EXAM_KINDS.length),
  weight: z.number().min(0).max(100),
  multiple: z.enum(MULTI_RULES),
  required: z.boolean(),
  columnLabel: z.string().trim().max(60).optional(),
  columnLabelAr: z.string().trim().max(60).optional(),
  examTitle: z.string().trim().max(60).optional(),
  term: z.string().trim().max(40).optional(),
});

const formulaSchema = z.object({
  parts: z.array(partSchema).min(1, "Gardez au moins un type de note").max(8),
  divisor: divisorSchema,
});

export const gradingConfigSchema = z.object({
  version: z.literal(1),
  secondary: formulaSchema,
  fundamental: formulaSchema,
  annual: z.object({
    enabled: z.boolean(),
    secondary: formulaSchema,
    fundamental: formulaSchema,
    passThreshold: z.number().min(0).max(20),
  }),
});

/**
 * Relit une configuration enregistrée. Une configuration illisible — écrite
 * par une version plus ancienne, ou abîmée — ne bloque pas les bulletins :
 * on repart du modèle par défaut plutôt que de ne rien afficher.
 */
export function parseGradingConfig(value: unknown): GradingConfig {
  const parsed = gradingConfigSchema.safeParse(upgradeAnnual(value));
  return parsed.success ? (parsed.data as GradingConfig) : defaultGradingConfig();
}

/**
 * Les premières règles enregistrées (septembre 2026) décrivaient l'année
 * par le seul poids de chaque trimestre. Ce format ne dit rien des notes à
 * prendre : on le remplace par le modèle annuel par défaut, en gardant le
 * choix de l'école d'avoir ou non un bulletin annuel. Le reste de sa règle
 * — trimestres, Fondamental — est conservé tel quel.
 */
function upgradeAnnual(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const config = value as { annual?: { terms?: unknown; enabled?: unknown } };
  if (config.annual && !("terms" in config.annual)) return renameAnnualColumns(config);
  if (!config.annual) return value;
  return {
    ...config,
    annual: {
      ...defaultAnnualConfig(),
      enabled: config.annual.enabled === true,
    },
  };
}

/**
 * Les en-têtes annuels livrés avant la maquette du bulletin annuel
 * (« Compo T2 × 2 », « Moy Int × 3 ») prennent ceux de la maquette validée
 * (« Compo T2 ×2 », « Meilleur Devoir ×3 ») : seuls ces libellés d'origine
 * sont remplacés, jamais un en-tête que l'école a choisi elle-même.
 */
function renameAnnualColumns<T>(config: T): T {
  const annual = (config as { annual?: { secondary?: { parts?: Record<string, unknown>[] } } }).annual;
  for (const part of annual?.secondary?.parts ?? []) {
    const label = part.columnLabel;
    if (typeof label !== "string") continue;
    const compo = /^Compo T(d)(?: × d)?$/.exec(label);
    if (compo) {
      part.columnLabel = `Compo T${compo[1]} ×${compo[1]}`;
      part.columnLabelAr = `امتحان${compo[1]}×${compo[1]}`;
    } else if (label === "Moy Int × 3" && part.term === undefined && part.multiple === "BEST") {
      part.columnLabel = "Meilleur Devoir ×3";
      part.columnLabelAr = "أحسن فرض×3";
    }
  }
  return config;
}

/**
 * Le bloc qui reçoit un examen de ce type (et, au bulletin annuel, de ce
 * trimestre) ; null si aucun ne le prend.
 */
export function partForKind(
  formula: Formula,
  kind: string | null,
  term?: string,
): FormulaPart | null {
  const inTerm = formula.parts.filter((p) => !p.term || term === undefined || p.term === term);
  const exact = inTerm.find(
    (p) => p.kinds.length > 0 && kind != null && p.kinds.includes(kind as ExamKind),
  );
  if (exact) return exact;
  return inTerm.find((p) => p.kinds.length === 0) ?? null;
}

export interface PartResult {
  partId: string;
  /** Notes du bloc, sur 20, dans l'ordre chronologique. */
  scores: (number | null)[];
  /** Index de la note retenue (meilleure ou dernière) ; null si moyenne ou somme. */
  usedIndex: number | null;
  /** Valeur du bloc après application de la règle ; null si aucune note. */
  value: number | null;
  /** Valeur × poids du bloc, telle qu'imprimée sur le bulletin. */
  weighted: number | null;
}

/** Applique la règle du bloc à ses notes. */
export function applyMultiRule(scores: number[], rule: MultiRule): { value: number; index: number | null } | null {
  if (scores.length === 0) return null;
  switch (rule) {
    case "BEST": {
      let index = 0;
      scores.forEach((s, i) => { if (s > scores[index]) index = i; });
      return { value: scores[index], index };
    }
    case "LAST":
      return { value: scores[scores.length - 1], index: scores.length - 1 };
    case "SUM":
      return { value: scores.reduce((a, b) => a + b, 0), index: null };
    case "AVERAGE":
    default:
      return { value: scores.reduce((a, b) => a + b, 0) / scores.length, index: null };
  }
}

export interface SubjectComputation {
  parts: PartResult[];
  /** Moyenne de la matière sur 20, arrondie au centième ; null si incomplète. */
  average: number | null;
  /** Diviseur réellement appliqué (4 chez Ngalam). */
  divisor: number;
}

/**
 * Moyenne d'une matière selon la règle de l'école : chaque bloc donne une
 * valeur, on multiplie par son poids, on additionne et on divise.
 *
 * Un bloc obligatoire sans note laisse la matière sans moyenne — jamais un
 * zéro. Un bloc facultatif sans note sort du calcul, poids compris, pour ne
 * pas pénaliser l'élève.
 */
export function computeSubjectAverage(
  formula: Formula,
  /** Notes sur 20 de chaque bloc, dans l'ordre des blocs de la formule. */
  scoresByPart: (number | null)[][],
): SubjectComputation {
  const parts: PartResult[] = [];
  let numerator = 0;
  let autoDivisor = 0;
  let missingRequired = false;

  formula.parts.forEach((part, index) => {
    const scores = scoresByPart[index] ?? [];
    const present = scores.filter((s): s is number => s != null);
    const applied = applyMultiRule(present, part.multiple);

    if (!applied) {
      if (part.required) missingRequired = true;
      parts.push({ partId: part.id, scores, usedIndex: null, value: null, weighted: null });
      return;
    }

    // L'index de la note retenue se rapporte à la liste complète du bloc,
    // notes manquantes comprises : c'est elle qu'affichent la grille et le
    // bulletin pour surligner le devoir retenu.
    let usedIndex: number | null = null;
    if (applied.index != null) {
      const positions = scores.map((s, i) => (s == null ? -1 : i)).filter((i) => i >= 0);
      usedIndex = positions[applied.index] ?? null;
    }

    numerator += applied.value * part.weight;
    autoDivisor += part.weight;
    parts.push({
      partId: part.id,
      scores,
      usedIndex,
      value: applied.value,
      weighted: roundHundredth(applied.value * part.weight),
    });
  });

  const divisor = formula.divisor.mode === "FIXED" ? formula.divisor.value : autoDivisor;
  const average =
    missingRequired || divisor <= 0 ? null : roundHundredth(numerator / divisor);

  return { parts, average, divisor };
}

/** Somme des poids : le diviseur automatique, affiché au directeur. */
export function totalWeight(formula: Formula): number {
  return formula.parts.reduce((sum, p) => sum + p.weight, 0);
}

export function divisorOf(formula: Formula): number {
  return formula.divisor.mode === "FIXED" ? formula.divisor.value : totalWeight(formula);
}

/**
 * La formule écrite en toutes lettres, pour que le directeur lise ce qu'il
 * vient de configurer : « (meilleur devoir × 3 + composition) ÷ 4 ».
 */
export function describeFormula(formula: Formula, labels: Record<MultiRule, string>): string {
  const terms = formula.parts.map((p) => {
    const base = `${labels[p.multiple]} ${p.label.toLowerCase()}`;
    return p.weight === 1 ? base : `${base} × ${p.weight}`;
  });
  return `(${terms.join(" + ")}) ÷ ${divisorOf(formula)}`;
}
