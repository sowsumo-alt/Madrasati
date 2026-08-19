import { z } from "zod";

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

/** Champs communs à la création et à la modification. */
const examDetailsShape = {
  title: z.string().trim().min(1, "Le titre est requis"),
  term: z.enum(TERMS),
  date: z.string().trim().min(1, "La date est requise"),
  durationMinutes: z.string().trim().optional().or(z.literal("")),
  maxScore: z.coerce.number().positive("La note maximale doit être positive"),
};

export const examSchema = z.object({
  // Plusieurs classes en une fois : une composition trimestrielle concerne
  // rarement une seule classe, et la recréer à l'identique pour chacune était
  // le geste le plus répétitif du module.
  classIds: z
    .array(z.string().min(1))
    .min(1, "Sélectionnez au moins une classe"),
  subjectId: z.string().min(1, "Sélectionnez une matière"),
  ...examDetailsShape,
});
export type ExamFormValues = z.infer<typeof examSchema>;

/** Modification : ni la classe ni la matière ne changent — des notes y sont
 *  déjà rattachées, les déplacer les rendrait incohérentes. */
export const examEditSchema = z.object(examDetailsShape);
export type ExamEditValues = z.infer<typeof examEditSchema>;
