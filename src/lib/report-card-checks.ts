import type { ReportCard } from "@/lib/report-card-compute";
import { roundHundredth } from "@/lib/grading";

/**
 * Vérifications faites sur un bulletin avant qu'il parte chez un parent :
 * les notes qui manquent, et l'évolution depuis le trimestre précédent.
 * Sans dépendance à la base ni à React : testé à part
 * (tests/report-card-checks.test.ts).
 */

export interface MissingGrade {
  subject: string;
  /** Nom du type de note dans la règle de l'école : « Devoirs », « Composition ». */
  part: string;
  /** L'élève était absent à l'épreuve : saisi, mais sans note. */
  absent: boolean;
}

/**
 * Notes attendues mais absentes : pour chaque matière active de la classe,
 * chaque type de note de la règle de l'école qui n'a reçu aucune note pour
 * cet élève. Un oubli de saisie donnerait sinon un bulletin faux sans que
 * personne ne s'en aperçoive.
 */
export function missingGrades(card: ReportCard): MissingGrade[] {
  const missing: MissingGrade[] = [];
  for (const result of card.results) {
    if (!result.active) continue;
    card.formula.parts.forEach((part, index) => {
      const detail = result.detail.parts[index];
      if (detail?.value != null) return;
      missing.push({
        subject: result.subjectName,
        part: part.label,
        absent: result.detail.absent[index] ?? false,
      });
    });
  }
  return missing;
}

export type Trend = "UP" | "DOWN" | "STABLE";

export interface Evolution {
  /** Écart avec le trimestre précédent, arrondi au centième. */
  delta: number;
  trend: Trend;
  /** Trimestre de comparaison : « Trimestre 1 ». */
  previousTerm: string;
}

export function evolution(
  current: number | null,
  previous: number | null,
  previousTerm: string,
): Evolution | null {
  if (current == null || previous == null) return null;
  const delta = roundHundredth(current - previous);
  return {
    delta,
    trend: delta > 0 ? "UP" : delta < 0 ? "DOWN" : "STABLE",
    previousTerm,
  };
}

/** Le trimestre d'avant ; null pour le premier (ou pour le bulletin annuel). */
export function previousTermOf(term: string, terms: readonly string[]): string | null {
  const index = terms.indexOf(term);
  return index > 0 ? terms[index - 1] : null;
}

export interface CardEvolution {
  general: Evolution | null;
  /** Par nom de matière. */
  bySubject: Record<string, Evolution>;
}

/**
 * Comparaison d'un bulletin avec celui du trimestre précédent du même élève :
 * la moyenne générale d'abord, puis chaque matière qui a une moyenne aux
 * deux trimestres.
 */
export function compareCards(current: ReportCard, previous: ReportCard | null): CardEvolution | null {
  if (!previous) return null;
  const bySubject: Record<string, Evolution> = {};
  for (const result of current.results) {
    const before = previous.results.find((r) => r.subjectName === result.subjectName);
    const e = evolution(result.average, before?.average ?? null, previous.term);
    if (e) bySubject[result.subjectName] = e;
  }
  return {
    general: evolution(current.average, previous.average, previous.term),
    bySubject,
  };
}

/** « +0,8 », « -1,5 », « 0 » : l'écart comme on l'écrit sur un bulletin. */
export function formatDelta(delta: number): string {
  const text = String(Math.abs(roundHundredth(delta))).replace(".", ",");
  return delta > 0 ? `+${text}` : delta < 0 ? `-${text}` : "0";
}
