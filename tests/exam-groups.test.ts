import { test } from "node:test";
import assert from "node:assert/strict";

import { examGroupKey, groupExams, isFullyGraded } from "../src/lib/exam-groups";

/**
 * Le lien entre les examens d'une même composition est déduit de leurs
 * données, sans colonne dédiée en base. C'est ce qui permet de regrouper aussi
 * les examens saisis un par un avant cette fonctionnalité — mais cela veut
 * dire que la règle de rapprochement est la seule chose qui tient l'ensemble.
 */

const exam = (
  title: string,
  date: string,
  subjectId: string,
  className = "",
) => ({ title, date, subjectId, className });

test("mêmes titre, jour et matière : c'est le même examen", () => {
  assert.equal(
    examGroupKey(exam("Composition Trimestre 1", "2026-12-01T00:00:00.000Z", "maths")),
    examGroupKey(exam("Composition Trimestre 1", "2026-12-01T00:00:00.000Z", "maths")),
  );
});

test("l'heure de la journée ne sépare pas deux examens du même jour", () => {
  assert.equal(
    examGroupKey(exam("Compo", "2026-12-01T00:00:00.000Z", "maths")),
    examGroupKey(exam("Compo", "2026-12-01T23:00:00.000Z", "maths")),
  );
});

test("la casse et les espaces en trop ne séparent pas deux saisies du même titre", () => {
  assert.equal(
    examGroupKey(exam("Composition  Trimestre 1 ", "2026-12-01T00:00:00.000Z", "maths")),
    examGroupKey(exam("composition trimestre 1", "2026-12-01T00:00:00.000Z", "maths")),
  );
});

test("deux matières différentes le même jour restent deux examens distincts", () => {
  // Le jour d'une composition générale, « Composition Trimestre 1 » désigne
  // l'épreuve de maths en 1AF et celle de français en 1AS. Les fondre
  // afficherait une progression de notes qui ne veut rien dire.
  assert.notEqual(
    examGroupKey(exam("Composition Trimestre 1", "2026-12-01T00:00:00.000Z", "maths")),
    examGroupKey(exam("Composition Trimestre 1", "2026-12-01T00:00:00.000Z", "francais")),
  );
});

test("le même titre à deux dates reste deux examens distincts", () => {
  assert.notEqual(
    examGroupKey(exam("Devoir n°1", "2026-12-01T00:00:00.000Z", "maths")),
    examGroupKey(exam("Devoir n°1", "2026-12-08T00:00:00.000Z", "maths")),
  );
});

test("trois classes créées ensemble forment un seul groupe partagé", () => {
  const groups = groupExams([
    exam("Composition Trimestre 2", "2027-02-10T00:00:00.000Z", "maths", "1AF"),
    exam("Composition Trimestre 2", "2027-02-10T00:00:00.000Z", "maths", "1AS"),
    exam("Composition Trimestre 2", "2027-02-10T00:00:00.000Z", "maths", "2AF"),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].exams.length, 3);
  assert.equal(groups[0].isShared, true);
  assert.deepEqual(groups[0].exams.map((e) => e.className), ["1AF", "1AS", "2AF"]);
});

test("un examen d'une seule classe n'est pas présenté comme partagé", () => {
  const groups = groupExams([exam("Devoir n°1", "2026-12-01T00:00:00.000Z", "maths", "1AF")]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].isShared, false);
});

test("l'ordre de la liste est préservé : un groupe prend la place de son premier examen", () => {
  // Sans cela, saisir une note ferait sauter les blocs d'une place à l'autre
  // à chaque rechargement de la page.
  const groups = groupExams([
    exam("Devoir récent", "2027-03-01T00:00:00.000Z", "maths", "1AF"),
    exam("Compo", "2027-02-10T00:00:00.000Z", "maths", "1AF"),
    exam("Compo", "2027-02-10T00:00:00.000Z", "maths", "1AS"),
    exam("Devoir ancien", "2027-01-05T00:00:00.000Z", "maths", "1AF"),
  ]);
  assert.deepEqual(
    groups.map((g) => g.exams[0].title),
    ["Devoir récent", "Compo", "Devoir ancien"],
  );
  assert.deepEqual(groups.map((g) => g.exams.length), [1, 2, 1]);
});

test("une liste vide ne produit aucun groupe", () => {
  assert.deepEqual(groupExams([]), []);
});

// ---------------------------------------------------------------------------
// Badge « Complet »
// ---------------------------------------------------------------------------

test("« Complet » dès que chaque élève a une note ou une absence", () => {
  assert.equal(isFullyGraded({ gradedCount: 12, studentCount: 12 }), true);
  assert.equal(isFullyGraded({ gradedCount: 11, studentCount: 12 }), false);
  assert.equal(isFullyGraded({ gradedCount: 0, studentCount: 12 }), false);
});

test("une classe vide n'est jamais annoncée « Complet »", () => {
  // 0 note sur 0 élève satisfait la comparaison sans rien vouloir dire : le
  // directeur croirait la saisie faite alors qu'il n'y a personne à noter.
  assert.equal(isFullyGraded({ gradedCount: 0, studentCount: 0 }), false);
});

test("plus de notes que d'élèves reste complet (un élève parti après la saisie)", () => {
  assert.equal(isFullyGraded({ gradedCount: 13, studentCount: 12 }), true);
});
