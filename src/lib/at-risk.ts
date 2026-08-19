import { prisma } from "@/lib/prisma";

export interface AtRiskStudent {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
  reasons: string[];
  parent: { firstName: string; lastName: string; phone: string } | null;
}

/**
 * Critères de déclenchement, énoncés en clair pour l'interface : un directeur
 * qui voit un élève signalé doit pouvoir vérifier la règle appliquée, sinon
 * l'alerte reste une boîte noire qu'il ne saura ni défendre auprès des parents
 * ni contester.
 */
export const AT_RISK_CRITERIA = [
  "Moyenne générale inférieure à 10/20, pondérée par les coefficients comme sur le bulletin",
  "Baisse de plus de 3 points entre les deux derniers examens",
  "Taux de présence inférieur à 80 % sur les 30 derniers jours (à partir de 5 appels)",
  "Au moins 2 incidents disciplinaires depuis le début du mois",
];

const LOW_AVERAGE_THRESHOLD = 10;
const GRADE_DROP_THRESHOLD = 3;
const ATTENDANCE_RATE_THRESHOLD = 80;
/** En dessous de ce nombre de présences enregistrées, le taux n'est pas assez
 *  significatif pour déclencher une alerte (évite les faux positifs en début
 *  d'année ou pour un élève tout juste inscrit). */
const MIN_ATTENDANCE_RECORDS = 5;
const DISCIPLINE_INCIDENT_THRESHOLD = 2;

/**
 * Détection automatique des élèves qui pourraient avoir besoin d'attention —
 * calculée à la demande à chaque appel (rien n'est stocké), donc toujours à
 * jour. `classIds` restreint le périmètre aux classes d'un enseignant ; omis,
 * la recherche porte sur toute l'école (vue directeur).
 */
export async function findAtRiskStudents(
  schoolId: string,
  classIds?: string[],
): Promise<AtRiskStudent[]> {
  const studentWhere = classIds
    ? { schoolId, status: "ACTIVE", classId: { in: classIds } }
    : { schoolId, status: "ACTIVE" };

  const students = await prisma.student.findMany({
    where: studentWhere,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      classRoom: { select: { name: true } },
      parentLinks: { where: { isPrimary: true }, include: { parent: true }, take: 1 },
    },
  });
  if (students.length === 0) return [];

  const studentIds = students.map((s) => s.id);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [grades, attendance, incidents] = await Promise.all([
    prisma.grade.findMany({
      where: { studentId: { in: studentIds }, isAbsent: false, score: { not: null } },
      select: {
        studentId: true,
        score: true,
        exam: {
          select: {
            date: true,
            maxScore: true,
            subjectId: true,
            subject: { select: { coefficient: true } },
            classRoom: {
              select: {
                classSubjects: { select: { subjectId: true, coefficientOverride: true } },
              },
            },
          },
        },
      },
      orderBy: { exam: { date: "desc" } },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds }, date: { gte: thirtyDaysAgo } },
      select: { studentId: true, status: true },
    }),
    prisma.disciplineIncident.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, date: { gte: startOfMonth } },
      _count: { _all: true },
    }),
  ]);

  // Deux lectures distinctes des mêmes notes.
  //
  // `recentByStudent` garde la suite chronologique brute, de la plus récente
  // à la plus ancienne : c'est elle qui sert au critère « moyenne en baisse ».
  //
  // `bySubject` regroupe par matière avec son coefficient, pour calculer une
  // moyenne générale par la même méthode que le bulletin (moyenne de chaque
  // matière, puis pondération). Une moyenne simple de toutes les notes donnait
  // un chiffre différent de celui imprimé sur le bulletin du même élève : le
  // directeur voyait « Moyenne faible : 9,8 » sur un élève dont le bulletin
  // annonçait 10,4, sans pouvoir trancher lequel des deux disait vrai.
  const recentByStudent = new Map<string, number[]>();
  const bySubject = new Map<
    string,
    Map<string, { total: number; count: number; coefficient: number }>
  >();
  for (const g of grades) {
    if (g.score == null || !g.exam.maxScore) continue;
    const scaled = (g.score / g.exam.maxScore) * 20;

    const list = recentByStudent.get(g.studentId) ?? [];
    list.push(scaled);
    recentByStudent.set(g.studentId, list);

    const override = g.exam.classRoom.classSubjects.find(
      (cs) => cs.subjectId === g.exam.subjectId,
    )?.coefficientOverride;
    const subjects = bySubject.get(g.studentId) ?? new Map();
    const entry = subjects.get(g.exam.subjectId) ?? {
      total: 0,
      count: 0,
      coefficient: override ?? g.exam.subject.coefficient,
    };
    entry.total += scaled;
    entry.count += 1;
    subjects.set(g.exam.subjectId, entry);
    bySubject.set(g.studentId, subjects);
  }

  /** Moyenne générale pondérée, identique à celle du bulletin. */
  function weightedAverageFor(studentId: string): number | null {
    const subjects = bySubject.get(studentId);
    if (!subjects || subjects.size === 0) return null;
    let weightedSum = 0;
    let totalCoefficient = 0;
    for (const entry of subjects.values()) {
      weightedSum += (entry.total / entry.count) * entry.coefficient;
      totalCoefficient += entry.coefficient;
    }
    return totalCoefficient > 0 ? weightedSum / totalCoefficient : null;
  }

  const attendanceByStudent = new Map<string, { present: number; total: number }>();
  for (const a of attendance) {
    const entry = attendanceByStudent.get(a.studentId) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (a.status === "PRESENT" || a.status === "LATE") entry.present += 1;
    attendanceByStudent.set(a.studentId, entry);
  }

  const incidentsByStudent = new Map(incidents.map((i) => [i.studentId, i._count._all]));

  const results: AtRiskStudent[] = [];

  for (const s of students) {
    const reasons: string[] = [];

    // Notes normalisées sur 20, de la plus récente à la plus ancienne
    // (ordre imposé par le tri de la requête ci-dessus).
    const grades20 = recentByStudent.get(s.id) ?? [];
    if (grades20.length > 0) {
      const average = weightedAverageFor(s.id);
      if (average != null && average < LOW_AVERAGE_THRESHOLD) {
        reasons.push(`Moyenne faible : ${average.toFixed(1)}/20`);
      }
      if (grades20.length >= 2) {
        const [latest, previous] = grades20;
        if (previous - latest > GRADE_DROP_THRESHOLD) {
          reasons.push(`Moyenne en baisse : ${previous.toFixed(1)} → ${latest.toFixed(1)}`);
        }
      }
    }

    const att = attendanceByStudent.get(s.id);
    if (att && att.total >= MIN_ATTENDANCE_RECORDS) {
      const rate = Math.round((att.present / att.total) * 100);
      if (rate < ATTENDANCE_RATE_THRESHOLD) {
        reasons.push(`Présence : ${rate}% sur 30 jours`);
      }
    }

    const incidentCount = incidentsByStudent.get(s.id) ?? 0;
    if (incidentCount >= DISCIPLINE_INCIDENT_THRESHOLD) {
      reasons.push(`${incidentCount} incidents disciplinaires ce mois-ci`);
    }

    if (reasons.length === 0) continue;

    const parent = s.parentLinks[0]?.parent ?? null;
    results.push({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      className: s.classRoom?.name ?? null,
      reasons,
      parent: parent
        ? { firstName: parent.firstName, lastName: parent.lastName, phone: parent.phone }
        : null,
    });
  }

  return results;
}
