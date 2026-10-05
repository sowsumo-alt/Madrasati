import type { Formula, FormulaPart } from "@/lib/grading-config";

/**
 * Feuille de notes papier : la liste des élèves d'une classe, déjà écrite,
 * que le directeur remet à un enseignant qui n'utilise pas (encore)
 * l'application. L'enseignant écrit ses notes à la main, le directeur les
 * saisit ensuite dans Madrasati — dans le même ordre que la grille de saisie.
 *
 * Sans dépendance à la base ni à React : testé à part
 * (tests/mark-sheet.test.ts).
 */

/**
 * Cases prévues sur la feuille pour un bloc de la règle de calcul : le
 * nombre choisi par l'école (Paramètres → Règle de calcul), sinon une case
 * pour un bloc qui ne garde que la dernière note (la composition) et trois
 * pour les autres (les devoirs).
 */
export function sheetCountOf(part: Pick<FormulaPart, "sheetCount" | "multiple">): number {
  if (part.sheetCount && part.sheetCount > 0) return part.sheetCount;
  return part.multiple === "LAST" ? 1 : 3;
}

export interface MarkSheetExam {
  id: string;
  title: string;
}

export interface MarkSheetColumn {
  key: string;
  title: string;
  /** Examen déjà créé (notes pré-remplies) ; null : case vide à remplir. */
  examId: string | null;
}

/**
 * Colonnes de notes, bloc par bloc, dans l'ordre de la règle de l'école :
 * « Devoir 1, Devoir 2, Devoir 3, Composition ». Avec `prefill`, les
 * examens déjà créés prennent les premières cases (sous leur titre) ; il
 * reste au moins les cases prévues par l'école.
 */
export function markSheetColumns(
  formula: Formula,
  examsByPart: MarkSheetExam[][],
  prefill: boolean,
): MarkSheetColumn[] {
  return formula.parts.flatMap((part, index) => {
    const count = sheetCountOf(part);
    const name = part.examTitle?.trim() || part.label;
    const exams = prefill ? (examsByPart[index] ?? []) : [];
    const columns: MarkSheetColumn[] = exams.map((exam) => ({
      key: exam.id,
      title: exam.title,
      examId: exam.id,
    }));
    for (let n = columns.length + 1; n <= Math.max(count, columns.length); n++) {
      columns.push({ key: `${part.id}:${n}`, title: count === 1 ? name : `${name} ${n}`, examId: null });
    }
    return columns;
  });
}

export const STUDENT_ORDERS = ["NUMBER", "FIRST_NAME"] as const;
export type StudentOrder = (typeof STUDENT_ORDERS)[number];

export interface SheetStudent {
  id: string;
  firstName: string;
  lastName: string;
}

const byLastName = (a: SheetStudent, b: SheetStudent) =>
  a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr");
const byFirstName = (a: SheetStudent, b: SheetStudent) =>
  a.firstName.localeCompare(b.firstName, "fr") || a.lastName.localeCompare(b.lastName, "fr");

/**
 * Les élèves avec leur N° — celui du bulletin et de la grille de saisie :
 * le rang par nom de famille — rangés dans l'ordre choisi. « N° » : l'ordre
 * de la grille de saisie, la saisie suit la feuille ligne à ligne.
 */
export function orderStudents<T extends SheetStudent>(
  students: T[],
  order: StudentOrder,
): (T & { number: number })[] {
  const numbered = [...students].sort(byLastName).map((s, i) => ({ ...s, number: i + 1 }));
  return order === "FIRST_NAME" ? numbered.sort(byFirstName) : numbered;
}

/**
 * Découpe la liste en pages A4 : `perPage` lignes par page, la dernière en
 * prenant au plus `lastPage` pour laisser la place à la signature. Chaque
 * page répète l'en-tête et les titres de colonnes.
 */
export function paginateRows(count: number, perPage: number, lastPage: number): [number, number][] {
  if (count === 0) return [[0, 0]];
  const pages: [number, number][] = [];
  let start = 0;
  while (count - start > lastPage) {
    // Ce qui reste ne tient pas avec la signature : une page pleine, en
    // gardant au moins un élève pour la dernière page — jamais une page
    // blanche qui ne porterait que la signature.
    const take = Math.min(perPage, count - start - 1);
    pages.push([start, start + take]);
    start += take;
  }
  pages.push([start, count]);
  return pages;
}
