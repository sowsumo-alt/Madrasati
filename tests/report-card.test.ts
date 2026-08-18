import { test } from "node:test";
import assert from "node:assert/strict";

import {
  weightedAverage,
  mentionFor,
  rankOf,
  termDateRange,
  type SubjectResult,
} from "../src/lib/report-card";

/**
 * Le calcul de moyenne est ce qui donne sa valeur à un bulletin : une erreur
 * ici n'est pas visible à l'œil et se retrouve imprimée, remise aux parents et
 * utilisée pour classer les élèves. Ces tests vérifient l'arithmétique elle-
 * même, coefficients différents compris.
 */

function subject(
  name: string,
  coefficient: number,
  average: number | null,
): SubjectResult {
  return {
    subjectName: name,
    subjectNameAr: null,
    coefficient,
    average,
    classAverage: null,
    examCount: average == null ? 0 : 1,
  };
}

test("moyenne ponderee sur quatre matieres de coefficients differents", () => {
  // 14×4 + 12×3 + 9×2 + 16×1 = 56 + 36 + 18 + 16 = 126, sur 4+3+2+1 = 10.
  const results = [
    subject("Mathématiques", 4, 14),
    subject("Français", 3, 12),
    subject("Physique-Chimie", 2, 9),
    subject("Éducation Physique", 1, 16),
  ];
  assert.equal(weightedAverage(results), 12.6);
});

test("le coefficient pese vraiment : la meme note change le resultat", () => {
  const fort = [subject("A", 5, 18), subject("B", 1, 8)];
  const faible = [subject("A", 1, 18), subject("B", 5, 8)];
  // 18×5+8×1 = 98 / 6 ; 18×1+8×5 = 58 / 6.
  assert.equal(weightedAverage(fort), 98 / 6);
  assert.equal(weightedAverage(faible), 58 / 6);
  assert.ok(weightedAverage(fort)! > weightedAverage(faible)!);
});

test("une matiere sans note est ignoree, pas comptee comme zero", () => {
  const avecTrou = [
    subject("Mathématiques", 4, 15),
    subject("Arabe", 3, null), // pas encore notée
  ];
  // Doit valoir 15, pas 15×4/(4+3) = 8,57.
  assert.equal(weightedAverage(avecTrou), 15);
});

test("aucune note du tout : pas de moyenne inventee", () => {
  assert.equal(weightedAverage([subject("A", 3, null)]), null);
  assert.equal(weightedAverage([]), null);
});

test("des coefficients nuls ne provoquent pas de division par zero", () => {
  assert.equal(weightedAverage([subject("A", 0, 12)]), null);
});

test("modifier une note se repercute sur la moyenne generale", () => {
  const avant = [
    subject("Mathématiques", 4, 10),
    subject("Français", 3, 12),
    subject("Arabe", 2, 14),
    subject("Anglais", 1, 8),
  ];
  // 40 + 36 + 28 + 8 = 112 / 10
  assert.equal(weightedAverage(avant), 11.2);

  const apres = avant.map((r) =>
    r.subjectName === "Mathématiques" ? subject("Mathématiques", 4, 18) : r,
  );
  // 72 + 36 + 28 + 8 = 144 / 10
  assert.equal(weightedAverage(apres), 14.4);
  assert.notEqual(weightedAverage(avant), weightedAverage(apres));
});

test("les mentions collent exactement a leurs bornes", () => {
  assert.equal(mentionFor(20), "EXCELLENT");
  assert.equal(mentionFor(16), "EXCELLENT");
  assert.equal(mentionFor(15.99), "VERY_GOOD");
  assert.equal(mentionFor(14), "VERY_GOOD");
  assert.equal(mentionFor(13.99), "GOOD");
  assert.equal(mentionFor(12), "GOOD");
  assert.equal(mentionFor(11.99), "FAIRLY_GOOD");
  assert.equal(mentionFor(10), "FAIRLY_GOOD");
  assert.equal(mentionFor(9.99), "PASSABLE");
  assert.equal(mentionFor(8), "PASSABLE");
  assert.equal(mentionFor(7.99), "INSUFFICIENT");
  assert.equal(mentionFor(0), "INSUFFICIENT");
  assert.equal(mentionFor(null), "NONE");
});

test("le rang compte les eleves strictement meilleurs", () => {
  const classe = [15, 12, 12, 9];
  assert.equal(rankOf(15, classe), 1);
  // Deux ex aequo partagent le meme rang, sans decaler l'un des deux.
  assert.equal(rankOf(12, classe), 2);
  assert.equal(rankOf(9, classe), 4);
  assert.equal(rankOf(null, classe), null);
});

test("les trimestres decoupent l'annee sans trou ni chevauchement", () => {
  const year = { startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30") };
  const t1 = termDateRange(year, "Trimestre 1");
  const t2 = termDateRange(year, "Trimestre 2");
  const t3 = termDateRange(year, "Trimestre 3");

  assert.equal(t1.start.getTime(), year.startDate.getTime());
  assert.equal(t1.end.getTime(), t2.start.getTime());
  assert.equal(t2.end.getTime(), t3.start.getTime());
  assert.equal(t3.end.getTime(), year.endDate.getTime());

  // Un libellé inconnu ne doit rien exclure plutôt que de vider le bulletin.
  const inconnu = termDateRange(year, "Semestre 1");
  assert.equal(inconnu.start.getTime(), year.startDate.getTime());
  assert.equal(inconnu.end.getTime(), year.endDate.getTime());
});

test("une note sur un bareme different est ramenee sur 20 avant ponderation", () => {
  // Reproduit le calcul de buildReportCards : (score / maxScore) × 20.
  const surQuarante = (12 / 40) * 20; // 6
  const surDix = (9 / 10) * 20; // 18
  assert.equal(surQuarante, 6);
  assert.equal(surDix, 18);

  const results = [subject("A", 2, surQuarante), subject("B", 3, surDix)];
  // 6×2 + 18×3 = 66 / 5 = 13,2
  assert.equal(weightedAverage(results), 13.2);
});
