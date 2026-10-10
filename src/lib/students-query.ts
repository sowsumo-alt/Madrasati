/**
 * Liste des élèves paginée côté serveur : recherche, classe, statut, lettre,
 * famille et page dans l'adresse ; mêmes règles de filtre qu'avant, appliquées
 * par le serveur, qui n'envoie que la page affichée.
 *
 * Sans dépendance à la base ni à React (tests/students-query.test.ts).
 */

import { LETTERS, matchesLetter } from "./initials";

export const STUDENTS_PAGE_SIZE = 10;

type Status = "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "GRADUATED";

/** Statut ↔ mot de l'adresse. */
const STATUS_WORDS: Record<Status, string> = {
  ACTIVE: "actifs",
  INACTIVE: "retires",
  TRANSFERRED: "transferes",
  GRADUATED: "diplomes",
};

export interface StudentsListState {
  query: string;
  /** "ALL", "NONE" (sans classe) ou l'identifiant d'une classe. */
  classFilter: string;
  status: "ALL" | Status;
  letter: string | null;
  /** Enfants d'une même famille (identifiant du parent), ou null. */
  family: string | null;
  page: number;
}

export interface StudentListItem {
  firstName: string;
  lastName: string;
  status: string;
  classId: string | null;
  className: string | null;
  parent: { id: string } | null;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseStudentsParams(params: Params): StudentsListState {
  const classe = one(params.classe);
  const statusWord = one(params.statut);
  const status = (Object.entries(STATUS_WORDS).find(([, w]) => w === statusWord)?.[0] as Status | undefined) ?? "ALL";
  const letter = one(params.lettre).toUpperCase();
  const page = Number.parseInt(one(params.page), 10);
  return {
    query: one(params.q).slice(0, 100),
    classFilter: classe === "aucune" ? "NONE" : classe || "ALL",
    status,
    letter: LETTERS.includes(letter) ? letter : null,
    family: one(params.famille) || null,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** L'adresse d'un état de la liste (sans « ? ») ; les valeurs par défaut sont omises. */
export function studentsParamsOf(state: StudentsListState): string {
  const p = new URLSearchParams();
  if (state.query.trim()) p.set("q", state.query.trim());
  if (state.classFilter !== "ALL") p.set("classe", state.classFilter === "NONE" ? "aucune" : state.classFilter);
  if (state.status !== "ALL") p.set("statut", STATUS_WORDS[state.status]);
  if (state.letter) p.set("lettre", state.letter);
  if (state.family) p.set("famille", state.family);
  if (state.page > 1) p.set("page", String(state.page));
  return p.toString();
}

/** Mêmes filtres que la liste d'avant : nom ou classe, statut, classe, initiale, famille. */
export function filterStudents<T extends StudentListItem>(students: T[], state: Omit<StudentsListState, "page">): T[] {
  const q = state.query.trim().toLowerCase();
  return students.filter((s) => {
    const matchesQuery =
      !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || (s.className ?? "").toLowerCase().includes(q);
    const matchesStatus = state.status === "ALL" || s.status === state.status;
    const matchesClass =
      state.classFilter === "ALL" ||
      (state.classFilter === "NONE" ? s.className == null : s.classId === state.classFilter);
    const matchesInitial = matchesLetter(`${s.firstName} ${s.lastName}`, state.letter);
    const matchesFamily = !state.family || s.parent?.id === state.family;
    return matchesQuery && matchesStatus && matchesClass && matchesInitial && matchesFamily;
  });
}
