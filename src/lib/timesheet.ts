/**
 * Pointage & paie des enseignants : les règles, sans base ni React
 * (tests/timesheet.test.ts). Toutes les heures sont en UTC, l'heure des écoles
 * mauritaniennes (voir src/lib/format.ts).
 *
 * - Une séance est attendue chaque jour d'après l'emploi du temps, sauf jour
 *   non travaillé.
 * - L'enseignant pointe de 10 min avant à 15 min après le début, depuis
 *   l'école (rayon GPS). Au-delà de 5 min après le début : retard.
 * - Sans pointage à la fin de la séance : absent.
 * - Paie : heures (présent, retard, remplacements faits) × taux horaire,
 *   moins les retards (si la règle de l'école les déduit), les avances et les
 *   autres déductions.
 */
import { isoWeekday } from "@/lib/schedule";

const MINUTE = 60_000;

export const CHECK_IN_OPENS_BEFORE = 10;
export const CHECK_IN_CLOSES_AFTER = 15;
export const LATE_AFTER = 5;
export const DEFAULT_RADIUS = 150;

export const SESSION_STATUSES = ["PENDING", "PRESENT", "LATE", "ABSENT", "EXCUSED", "REPLACED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
/** Ce que la direction peut fixer à la main (« À venir » ne se choisit pas). */
export const CORRECTABLE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED", "REPLACED"] as const;
export type CorrectableStatus = (typeof CORRECTABLE_STATUSES)[number];

export const STATUS_LABELS: Record<SessionStatus, string> = {
  PENDING: "À venir",
  PRESENT: "Présent",
  LATE: "Retard",
  ABSENT: "Absent",
  EXCUSED: "Absent justifié",
  REPLACED: "Remplacé",
};

/** Couleur du tableau du jour : vert présent, orange retard, rouge absent. */
export const STATUS_TONE: Record<SessionStatus, "green" | "orange" | "red" | "gray" | "blue" | "violet"> = {
  PENDING: "gray",
  PRESENT: "green",
  LATE: "orange",
  ABSENT: "red",
  EXCUSED: "blue",
  REPLACED: "violet",
};

export type LateDeduction = "PRORATA" | "NONE";
export const LATE_DEDUCTION_LABELS: Record<LateDeduction, string> = {
  PRORATA: "Déduire les retards au prorata des minutes",
  NONE: "Ne pas déduire les retards",
};
export const isLateDeduction = (v: unknown): v is LateDeduction => v === "PRORATA" || v === "NONE";

// — Fenêtre de pointage ————————————————————————————————————————————————

export function checkInWindow(startsAt: Date): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(startsAt.getTime() - CHECK_IN_OPENS_BEFORE * MINUTE),
    closesAt: new Date(startsAt.getTime() + CHECK_IN_CLOSES_AFTER * MINUTE),
  };
}

/** Le bouton « Je suis en classe » est-il actif ? De 10 min avant à 15 min après le début. */
export function isCheckInOpen(startsAt: Date, now: Date): boolean {
  const { opensAt, closesAt } = checkInWindow(startsAt);
  return now >= opensAt && now <= closesAt;
}

/** Statut d'un pointage : en retard au-delà de 5 min après le début, avec les minutes depuis le début. */
export function checkInResult(startsAt: Date, at: Date): { status: "PRESENT" | "LATE"; lateMinutes: number } {
  const elapsed = at.getTime() - startsAt.getTime();
  if (elapsed > LATE_AFTER * MINUTE) return { status: "LATE", lateMinutes: Math.floor(elapsed / MINUTE) };
  return { status: "PRESENT", lateMinutes: 0 };
}

/** Sans pointage à la fin de la séance, l'enseignant est absent. */
export function effectiveStatus(session: { status: string; endsAt: Date }, now: Date): SessionStatus {
  const status = (SESSION_STATUSES as readonly string[]).includes(session.status) ? (session.status as SessionStatus) : "PENDING";
  return status === "PENDING" && now >= session.endsAt ? "ABSENT" : status;
}

// — Position ————————————————————————————————————————————————————————————

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export const isGeoPoint = (p: unknown): p is GeoPoint => {
  const q = p as GeoPoint | null;
  return (
    !!q &&
    Number.isFinite(q.latitude) &&
    Number.isFinite(q.longitude) &&
    Math.abs(q.latitude) <= 90 &&
    Math.abs(q.longitude) <= 180
  );
};

/** Distance à vol d'oiseau, en mètres (formule de haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type PositionCheck =
  | { ok: true; distance: number }
  | { ok: false; reason: "NOT_CONFIGURED" | "INVALID" | "TOO_FAR"; distance?: number };

/** Le téléphone est-il dans le rayon de l'école ? */
export function checkPosition(
  school: { latitude: number | null; longitude: number | null; radius: number },
  at: unknown,
): PositionCheck {
  if (school.latitude == null || school.longitude == null) return { ok: false, reason: "NOT_CONFIGURED" };
  if (!isGeoPoint(at)) return { ok: false, reason: "INVALID" };
  const distance = Math.round(distanceMeters({ latitude: school.latitude, longitude: school.longitude }, at));
  return distance <= school.radius ? { ok: true, distance } : { ok: false, reason: "TOO_FAR", distance };
}

// — Séances attendues ———————————————————————————————————————————————————

/** « 2026-11-20 » : la clé d'un jour (UTC). */
export const dayKey = (date: Date) => date.toISOString().slice(0, 10);
export const startOfDayUtc = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export interface PlannedSlot {
  id: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  classId: string;
  className: string;
  subjectName: string;
  /** L'enseignant de la matière dans cette classe ; sans enseignant, pas de séance. */
  teacherId: string | null;
}

export interface PlannedSession {
  scheduleSlotId: string;
  teacherId: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  classId: string;
  className: string;
  subjectName: string;
}

/** Les séances d'un jour d'après l'emploi du temps ; aucune un jour non travaillé. */
export function plannedSessions(slots: PlannedSlot[], date: Date, nonWorkingDays: Set<string>): PlannedSession[] {
  const day = startOfDayUtc(date);
  if (nonWorkingDays.has(dayKey(day))) return [];
  const weekday = isoWeekday(day);
  return slots
    .filter((s) => s.dayOfWeek === weekday && s.teacherId && s.endMinutes > s.startMinutes)
    .map((s) => ({
      scheduleSlotId: s.id,
      teacherId: s.teacherId!,
      date: day,
      startsAt: new Date(day.getTime() + s.startMinutes * MINUTE),
      endsAt: new Date(day.getTime() + s.endMinutes * MINUTE),
      classId: s.classId,
      className: s.className,
      subjectName: s.subjectName,
    }));
}

/** Les jours de `from` à `to` inclus (UTC). */
export function daysBetween(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let d = startOfDayUtc(from); d <= to; d = new Date(d.getTime() + 24 * 60 * MINUTE)) days.push(d);
  return days;
}

// — Mois ————————————————————————————————————————————————————————————————

/** « 2026-11 » → bornes du mois (UTC) ; null si illisible. */
export function monthRange(key: string | null | undefined): { key: string; start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { key: m[0], start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
}
export const monthKeyOf = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 2026-11 » → « Novembre 2026 ». */
export function monthLabelOf(key: string): string {
  const range = monthRange(key);
  if (!range) return key;
  const name = MONTHS[range.start.getUTCMonth()];
  return `${name[0].toUpperCase()}${name.slice(1)} ${range.start.getUTCFullYear()}`;
}

// — Affichage ————————————————————————————————————————————————————————————

/** JJ/MM/AAAA. */
export const dmy = (date: Date) =>
  `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
/** HH:MM. */
export const hm = (date: Date) => `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
/** 750 → « 12 h 30 », 120 → « 2 h ». */
export function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export const sessionMinutes = (s: { startsAt: Date; endsAt: Date }) =>
  Math.max(0, Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / MINUTE));

// — Paie ————————————————————————————————————————————————————————————————

export interface PaySession {
  teacherId: string;
  replacementTeacherId: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  lateMinutes: number;
}

export interface PayAdjustment {
  kind: string;
  amount: number;
}

export interface TeacherPay {
  teacherId: string;
  hourlyRate: number | null;
  /** Minutes payées : séances présentes ou en retard, et remplacements faits. */
  minutes: number;
  replacementMinutes: number;
  honoraires: number;
  lateMinutes: number;
  lateDeduction: number;
  advances: number;
  otherDeductions: number;
  deductions: number;
  net: number;
  counts: Record<SessionStatus, number>;
}

/**
 * La paie d'un enseignant pour un mois. Les montants sont arrondis une seule
 * fois, au total : 3 séances de 50 min à 100 MRU/h font 250 MRU, pas 3 × 83.
 */
export function computeTeacherPay(
  teacherId: string,
  hourlyRate: number | null,
  sessions: PaySession[],
  adjustments: PayAdjustment[],
  lateRule: LateDeduction,
  now: Date,
): TeacherPay {
  const rate = hourlyRate ?? 0;
  const counts = Object.fromEntries(SESSION_STATUSES.map((s) => [s, 0])) as Record<SessionStatus, number>;
  let minutes = 0;
  let replacementMinutes = 0;
  let lateMinutes = 0;
  for (const s of sessions) {
    const status = effectiveStatus(s, now);
    if (s.teacherId === teacherId) {
      counts[status]++;
      if (status === "PRESENT" || status === "LATE") minutes += sessionMinutes(s);
      if (status === "LATE") lateMinutes += Math.min(Math.max(0, s.lateMinutes), sessionMinutes(s));
    } else if (status === "REPLACED" && s.replacementTeacherId === teacherId) {
      const m = sessionMinutes(s);
      minutes += m;
      replacementMinutes += m;
    }
  }
  const honoraires = Math.round((minutes * rate) / 60);
  const lateDeduction = lateRule === "PRORATA" ? Math.round((lateMinutes * rate) / 60) : 0;
  const advances = adjustments.filter((a) => a.kind === "ADVANCE").reduce((sum, a) => sum + a.amount, 0);
  const otherDeductions = adjustments.filter((a) => a.kind !== "ADVANCE").reduce((sum, a) => sum + a.amount, 0);
  const deductions = lateDeduction + advances + otherDeductions;
  return {
    teacherId,
    hourlyRate,
    minutes,
    replacementMinutes,
    honoraires,
    lateMinutes,
    lateDeduction,
    advances,
    otherDeductions,
    deductions,
    net: honoraires - deductions,
    counts,
  };
}

/** Les mois consultables, du plus récent au plus ancien : depuis l'activation du pointage, 12 au plus. */
export function timesheetMonths(startDate: Date | null, now: Date): string[] {
  const keys: string[] = [];
  const first = startDate ? Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1) : null;
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    if (first != null && d.getTime() < first) break;
    keys.push(monthKeyOf(d));
  }
  return keys;
}
