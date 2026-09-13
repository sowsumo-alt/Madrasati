import { z } from "zod";
import { EXAM_KINDS, parseTime } from "@/lib/exams";

export const TERMS = ["Trimestre 1", "Trimestre 2", "Trimestre 3"] as const;

/**
 * Portée d'une modification ou d'une suppression sur un examen partagé par
 * plusieurs classes : cette classe seule, ou toutes les classes qui passent le
 * même examen. Sans ce choix explicite, corriger une date de composition
 * obligeait à rouvrir chaque classe une par une — ou risquait de toutes les
 * modifier sans le vouloir.
 */
export const EXAM_SCOPES = ["one", "group"] as const;
export type ExamScope = (typeof EXAM_SCOPES)[number];
export const examScopeSchema = z.enum(EXAM_SCOPES);

/**
 * Formulaire d'examen, le même pour la création et la modification. En
 * modification, la classe et la matière sont affichées mais figées (voir
 * examEditSchema).
 */
export const examSchema = z.object({
  // Plusieurs classes en une fois : une composition trimestrielle concerne
  // rarement une seule classe, et la recréer à l'identique pour chacune était
  // le geste le plus répétitif du module.
  classIds: z.array(z.string().min(1)).min(1, "Sélectionnez au moins une classe"),
  subjectId: z.string().min(1, "Sélectionnez une matière"),
  title: z.string().trim().min(1, "Le nom de l'examen est requis"),
  // `includes` et non une comparaison : TypeScript en ferait un garde de type
  // et restreindrait le champ aux seuls types connus, alors qu'il démarre vide.
  kind: z
    .string()
    .refine((v) => (EXAM_KINDS as readonly string[]).includes(v), "Choisissez le type d'examen"),
  term: z.enum(TERMS),
  date: z.string().trim().min(1, "La date est requise"),
  startTime: z
    .string()
    .trim()
    .refine((v) => parseTime(v) != null, "L'heure de début est requise"),
  durationMinutes: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, "Indiquez la durée en minutes"),
  instructions: z
    .string()
    .trim()
    .max(500, "500 caractères au maximum")
    .optional()
    .or(z.literal("")),
  maxScore: z.coerce.number().positive("La note maximale doit être positive"),
});
export type ExamFormValues = z.infer<typeof examSchema>;

/** Modification : ni la classe ni la matière ne changent — des notes y sont
 *  déjà rattachées, les déplacer les rendrait incohérentes. */
export const examEditSchema = examSchema.omit({ classIds: true, subjectId: true });
export type ExamEditValues = z.infer<typeof examEditSchema>;
