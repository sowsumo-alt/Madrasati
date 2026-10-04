import { addMonths, periodLabel } from "@/lib/tuition";

/**
 * Lignes d'un reçu groupé, assez courtes pour tenir sur une demi-feuille :
 * l'inscription et plusieurs mois de scolarité, pour un ou plusieurs enfants,
 * faisaient une ligne par mois et le reçu débordait — total et somme en
 * lettres disparaissaient sous la coupe.
 *
 * Les mois d'un même enfant sont réunis en une seule ligne « Frais de
 * scolarité », et les mois qui se suivent en une seule période :
 * « octobre à novembre 2026, juin 2027 ».
 */

export interface ReceiptPart {
  studentId: string;
  /** « Aminata Ba — 1AF » */
  studentLabel: string;
  feeLabel: string;
  amount: number;
  /** Mois couverts par une échéance de scolarité ; null pour un autre frais. */
  periodStart: Date | null;
  periodEnd: Date | null;
}

export interface ReceiptLine {
  label: string;
  detail: string | null;
  amount: number;
}

/** « octobre à novembre 2026, juin 2027 » : périodes réunies quand elles se suivent. */
export function mergedPeriods(periods: { start: Date; end: Date }[]): string {
  const sorted = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());
  const runs: { start: Date; end: Date }[] = [];
  for (const p of sorted) {
    const last = runs[runs.length - 1];
    if (last && addMonths(last.end, 1).getTime() >= p.start.getTime()) {
      if (p.end > last.end) last.end = p.end;
    } else {
      runs.push({ start: p.start, end: p.end });
    }
  }
  return runs.map((r) => periodLabel(r.start, r.end)).join(", ");
}

const isTuition = (p: ReceiptPart) => Boolean(p.periodStart && p.periodEnd);
const sum = (parts: ReceiptPart[]) => parts.reduce((s, p) => s + p.amount, 0);
const periodsOf = (parts: ReceiptPart[]) =>
  mergedPeriods(parts.filter(isTuition).map((p) => ({ start: p.periodStart!, end: p.periodEnd! })));

/** « Inscription » plutôt que « Frais d'inscription — 2026-2027 » dans un détail. */
function shortLabel(label: string) {
  return label.startsWith("Frais d'inscription") ? "Inscription" : label.replace(/ — .*$/, "");
}

/**
 * Un seul élève : chaque frais à part (l'inscription), et tous ses mois de
 * scolarité sur une ligne.
 */
export function studentReceiptLines(parts: ReceiptPart[]): ReceiptLine[] {
  const lines: ReceiptLine[] = parts
    .filter((p) => !isTuition(p))
    .map((p) => ({ label: p.feeLabel, detail: null, amount: p.amount }));
  const tuition = parts.filter(isTuition);
  if (tuition.length > 0) {
    lines.push({ label: "Frais de scolarité", detail: periodsOf(tuition), amount: sum(tuition) });
  }
  return lines;
}

/** Une famille : une ligne par enfant, le détail dit ce qu'elle couvre. */
export function familyReceiptLines(parts: ReceiptPart[]): ReceiptLine[] {
  const byStudent = new Map<string, ReceiptPart[]>();
  for (const p of parts) byStudent.set(p.studentId, [...(byStudent.get(p.studentId) ?? []), p]);
  return [...byStudent.values()].map((own) => {
    const others = own.filter((p) => !isTuition(p)).map((p) => shortLabel(p.feeLabel));
    const tuition = own.filter(isTuition);
    const detail = [...others, ...(tuition.length > 0 ? [`Scolarité : ${periodsOf(tuition)}`] : [])].join(" · ");
    return { label: own[0].studentLabel, detail: detail || null, amount: sum(own) };
  });
}
