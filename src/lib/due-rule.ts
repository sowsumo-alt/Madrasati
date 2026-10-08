/**
 * Quand un mois passe de « à venir » à « dû » : la règle de l'école.
 *
 * Une échéance de scolarité est enregistrée au 1er du mois où elle se paie
 * (le mois lui-même ; le mois suivant pour le mois d'entrée de l'élève, voir
 * lib/tuition-plan.ts). L'école fixe dans ses Paramètres le dernier jour pour
 * payer (« le 5 ») et des jours de tolérance : le mois reste « à venir »
 * jusqu'au soir du jour limite + tolérance, et devient dû — impayé s'il n'est
 * pas soldé — le lendemain à 0 h.
 *
 * La règle s'applique à la lecture : changer le paramètre ne réécrit aucune
 * échéance enregistrée. Les autres frais (inscription, frais ajoutés à la
 * main) gardent leur échéance telle quelle.
 *
 * Sans dépendance : utilisable côté serveur comme dans le navigateur.
 */

export interface DueRule {
  /** Dernier jour du mois pour payer, de 1 à 28. */
  dueDay: number;
  /** Jours de tolérance après le jour limite. */
  graceDays: number;
}

export const DUE_DAY_MAX = 28;
export const GRACE_DAYS_MAX = 30;
/** Sans réglage : le mois se paie le 1er, sans tolérance. */
export const DEFAULT_DUE_RULE: DueRule = { dueDay: 1, graceDays: 0 };

/** La règle d'une école, bornée : une valeur hors limites ne casse jamais le calcul. */
export function dueRuleOf(
  school: { paymentDueDay?: number | null; paymentGraceDays?: number | null } | null | undefined,
): DueRule {
  const bounded = (value: number | null | undefined, min: number, max: number, fallback: number) =>
    typeof value === "number" && Number.isInteger(value) ? Math.min(Math.max(value, min), max) : fallback;
  return {
    dueDay: bounded(school?.paymentDueDay, 1, DUE_DAY_MAX, DEFAULT_DUE_RULE.dueDay),
    graceDays: bounded(school?.paymentGraceDays, 0, GRACE_DAYS_MAX, DEFAULT_DUE_RULE.graceDays),
  };
}

export interface DueLine {
  dueDate: Date | string;
  /** Premier mois couvert : présent sur les échéances de scolarité seulement. */
  periodStart?: Date | string | null;
}

const DAY_MS = 86_400_000;

/**
 * Dernier jour pour payer, sans la tolérance : l'échéance annoncée au parent.
 * Une échéance fixée à la main plus tard dans le mois est respectée.
 */
export function payByDate(line: DueLine, rule: DueRule): Date {
  const stored = new Date(line.dueDate);
  if (!line.periodStart) return stored;
  const storedDay = Date.UTC(stored.getUTCFullYear(), stored.getUTCMonth(), stored.getUTCDate());
  const limit = Date.UTC(stored.getUTCFullYear(), stored.getUTCMonth(), rule.dueDay);
  return new Date(Math.max(storedDay, limit));
}

/**
 * Le moment où la ligne devient due : la fin (23 h 59) du jour limite +
 * tolérance. C'est l'échéance à donner à balanceOf, feeDisplayStatus et
 * daysOverdue : « dû » dès le lendemain 0 h, et le premier jour d'impayé
 * compte 1 jour de retard.
 */
export function effectiveDueDate(line: DueLine, rule: DueRule): Date {
  if (!line.periodStart) return new Date(line.dueDate);
  return new Date(payByDate(line, rule).getTime() + (rule.graceDays + 1) * DAY_MS - 1);
}

/** La même ligne, son échéance remplacée par le moment où elle devient due. */
export function withDueRule<T extends DueLine>(line: T, rule: DueRule): T & { dueDate: Date } {
  return { ...line, dueDate: effectiveDueDate(line, rule) };
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/**
 * La règle en une phrase, sur l'exemple du mois de `today` :
 * « Octobre se paie au plus tard le 5 octobre ; non réglé, il devient impayé le 9 octobre. »
 */
export function describeDueRule(rule: DueRule, today = new Date()): string {
  const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const line = { dueDate: month, periodStart: month };
  const dayText = (d: Date) => `${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const name = MONTHS[month.getUTCMonth()];
  const unpaidFrom = new Date(effectiveDueDate(line, rule).getTime() + 1);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} se paie au plus tard le ${dayText(payByDate(line, rule))}${
    rule.graceDays > 0 ? `, avec ${rule.graceDays} jour${rule.graceDays > 1 ? "s" : ""} de tolérance` : ""
  } ; non réglé, il devient impayé le ${dayText(unpaidFrom)}.`;
}
