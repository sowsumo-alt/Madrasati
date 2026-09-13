/**
 * Règles des examens partagées par les pages Examens (directeur et
 * enseignant), le formulaire et les tests (tests/exams.test.ts).
 *
 * Les dates d'examen sont des jours à minuit UTC, et les heures celles de
 * l'école : la Mauritanie vit en UTC toute l'année (voir TIME_ZONE dans
 * src/lib/format.ts).
 */

export const EXAM_KINDS = ["DEVOIR", "CONTROLE", "INTERROGATION", "COMPOSITION"] as const;
export type ExamKind = (typeof EXAM_KINDS)[number];

export function isExamKind(value: string | null | undefined): value is ExamKind {
  return value != null && (EXAM_KINDS as readonly string[]).includes(value);
}

export type ExamStatus = "PLANNED" | "ONGOING" | "DONE";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
/** Durée retenue pour un examen dont la durée n'a pas été saisie. */
const DEFAULT_DURATION_MINUTES = 60;

/**
 * État d'un examen à l'instant `now` : planifié, en cours ou terminé.
 *
 * Avec une heure de début, l'examen est en cours de son début à sa fin. Sans
 * heure — les examens planifiés avant l'ajout de ce champ — il l'est toute la
 * journée : on sait quel jour il a lieu, pas à quelle heure.
 */
export function examStatus(
  exam: { date: Date | string; startMinutes: number | null; durationMinutes: number | null },
  now: Date,
): ExamStatus {
  const day = new Date(exam.date);
  const dayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const start = exam.startMinutes == null ? dayStart : dayStart + exam.startMinutes * MINUTE_MS;
  const end =
    exam.startMinutes == null
      ? dayStart + DAY_MS
      : start + (exam.durationMinutes ?? DEFAULT_DURATION_MINUTES) * MINUTE_MS;

  const time = now.getTime();
  if (time < start) return "PLANNED";
  if (time < end) return "ONGOING";
  return "DONE";
}

/**
 * Trimestre proposé d'après la date de l'examen : septembre à décembre pour le
 * premier, janvier à mars pour le deuxième, avril à août pour le troisième.
 * Une proposition seulement : le directeur la corrige si le calendrier de son
 * école est différent.
 */
export function defaultTermForDate(
  date: Date | string,
): "Trimestre 1" | "Trimestre 2" | "Trimestre 3" {
  const month = new Date(date).getUTCMonth(); // 0 = janvier
  if (month >= 8) return "Trimestre 1";
  if (month <= 2) return "Trimestre 2";
  return "Trimestre 3";
}

/** "08:30" → 510 ; `null` si la saisie n'est pas une heure valide. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
