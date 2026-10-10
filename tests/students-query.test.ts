import { test } from "node:test";
import assert from "node:assert/strict";

import { filterStudents, parseStudentsParams, studentsParamsOf } from "../src/lib/students-query";

const student = (firstName: string, over: Partial<{ status: string; classId: string | null; className: string | null; parentId: string }> = {}) => ({
  firstName,
  lastName: "Ba",
  status: over.status ?? "ACTIVE",
  classId: over.classId === undefined ? "c1" : over.classId,
  className: over.className === undefined ? "6AF" : over.className,
  parent: over.parentId ? { id: over.parentId } : null,
});

test("l'adresse garde recherche, classe, statut, lettre, famille et page", () => {
  const state = parseStudentsParams({ q: "Awa", classe: "aucune", statut: "retires", lettre: "b", famille: "p1", page: "2" });
  assert.deepEqual(state, { query: "Awa", classFilter: "NONE", status: "INACTIVE", letter: "B", family: "p1", page: 2 });
  assert.deepEqual(parseStudentsParams(Object.fromEntries(new URLSearchParams(studentsParamsOf(state)))), state);
  assert.equal(studentsParamsOf(parseStudentsParams({})), "");
  // Lien depuis la fiche d'une classe et recherche globale de l'en-tête.
  assert.equal(parseStudentsParams({ classe: "c9" }).classFilter, "c9");
  assert.equal(parseStudentsParams({ q: "Diallo" }).query, "Diallo");
});

test("mêmes filtres qu'avant : nom ou classe, statut, sans classe, famille", () => {
  const list = [
    student("Awa", { parentId: "p1" }),
    student("Moussa", { status: "INACTIVE", parentId: "p1" }),
    student("Sidi", { classId: null, className: null }),
    student("Zeinab", { classId: "c2", className: "5AF" }),
  ];
  const names = (q: Record<string, string>) => filterStudents(list, parseStudentsParams(q)).map((s) => s.firstName);
  assert.deepEqual(names({ q: "awa" }), ["Awa"]);
  assert.deepEqual(names({ q: "5af" }), ["Zeinab"]);
  assert.deepEqual(names({ statut: "retires" }), ["Moussa"]);
  assert.deepEqual(names({ classe: "aucune" }), ["Sidi"]);
  assert.deepEqual(names({ famille: "p1" }), ["Awa", "Moussa"]);
  assert.deepEqual(names({ lettre: "Z" }), ["Zeinab"]);
});
