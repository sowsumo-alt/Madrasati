import type { Prisma } from "@prisma/client";
import { UserError } from "@/lib/user-error";

/**
 * Matricule d'un élève : « 2026-0042 », l'année de son inscription et son rang
 * parmi les inscrits de cette année dans l'école. Donné automatiquement à
 * l'inscription (élève seul, famille, import) ; le directeur peut le changer,
 * par exemple pour reprendre les numéros que son école utilisait déjà. Unique
 * dans l'école (index en base).
 */

/** « 2026-0042 » : quatre chiffres au moins, davantage au-delà de 9 999. */
export function formatMatricule(year: number, rank: number): string {
  return `${year}-${String(rank).padStart(4, "0")}`;
}

/** Plus grand rang déjà pris pour une année (« 2026-0042 » → 42) ; 0 s'il n'y en a aucun. */
export function highestRank(matricules: (string | null)[], year: number): number {
  const prefix = `${year}-`;
  let max = 0;
  for (const m of matricules) {
    if (!m?.startsWith(prefix)) continue;
    const rank = Number(m.slice(prefix.length));
    if (Number.isInteger(rank) && rank > max) max = rank;
  }
  return max;
}

/** Matricules suivants pour des élèves inscrits aux dates données, dans l'ordre. */
export function nextMatricules(taken: (string | null)[], enrollmentDates: Date[]): string[] {
  const next = new Map<number, number>();
  return enrollmentDates.map((date) => {
    const year = date.getUTCFullYear();
    const rank = (next.get(year) ?? highestRank(taken, year)) + 1;
    next.set(year, rank);
    return formatMatricule(year, rank);
  });
}

/** Saisie du directeur : espaces retirés, vide = garder ou attribuer automatiquement. */
export function cleanMatricule(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().replace(/\s+/g, " ");
  return v ? v : null;
}

/**
 * Matricules de nouveaux élèves, dans la transaction qui les crée. Un verrou
 * par école empêche deux inscriptions simultanées de recevoir le même numéro.
 * `wanted` : numéros saisis (import, formulaire) ; un numéro déjà pris est refusé.
 */
export async function assignMatricules(
  tx: Prisma.TransactionClient,
  schoolId: string,
  students: { enrollmentDate: Date; wanted?: string | null }[],
): Promise<string[]> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"students:" + schoolId}, 0))`;
  const years = [...new Set(students.map((s) => s.enrollmentDate.getUTCFullYear()))];
  const existing = await tx.student.findMany({
    where: {
      schoolId,
      OR: [
        ...years.map((y) => ({ matricule: { startsWith: `${y}-` } })),
        { matricule: { in: students.map((s) => cleanMatricule(s.wanted)).filter((m): m is string => !!m) } },
      ],
    },
    select: { matricule: true },
  });
  const taken = existing.map((e) => e.matricule);
  const result: string[] = [];
  for (const s of students) {
    const wanted = cleanMatricule(s.wanted);
    if (wanted) {
      if (taken.includes(wanted)) throw new UserError(`Le matricule ${wanted} est déjà utilisé dans l'école.`);
      taken.push(wanted);
      result.push(wanted);
    } else {
      const [m] = nextMatricules(taken, [s.enrollmentDate]);
      taken.push(m);
      result.push(m);
    }
  }
  return result;
}

/** Changement de matricule : refusé s'il appartient déjà à un autre élève de l'école. */
export async function assertMatriculeFree(
  db: Prisma.TransactionClient,
  schoolId: string,
  matricule: string,
  studentId: string,
) {
  const other = await db.student.findFirst({
    where: { schoolId, matricule, id: { not: studentId } },
    select: { firstName: true, lastName: true },
  });
  if (other) throw new UserError(`Le matricule ${matricule} est déjà celui de ${other.firstName} ${other.lastName}.`);
}
