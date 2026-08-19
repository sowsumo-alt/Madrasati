import { test } from "node:test";
import assert from "node:assert/strict";

import { outstandingTotal, type OutstandingFee } from "../src/lib/finance";
import { currentAcademicYear } from "../src/lib/school-setup";

/**
 * Deux règles que l'audit de pré-lancement a trouvées fausses, et qui se
 * voient toutes les deux dès la première minute d'utilisation : le montant
 * annoncé comme impayé, et l'année scolaire attribuée à une école qui
 * s'inscrit. Elles sont testées ici parce qu'aucune des deux n'échoue
 * bruyamment — elles affichent simplement un chiffre faux.
 */

function fee(id: string, amount: number): OutstandingFee {
  return { id, amount };
}

// ---------------------------------------------------------------------------
// Reste dû
// ---------------------------------------------------------------------------

test("un frais sans aucun paiement compte pour son montant entier", () => {
  const total = outstandingTotal([fee("a", 15000)], new Map());
  assert.equal(total, 15000);
});

test("un paiement partiel est déduit : c'est le reste qui compte, pas le montant facturé", () => {
  // Le cas exact du bug : 15 000 facturés, 10 000 déjà encaissés. Le tableau
  // de bord annonçait 15 000 alors que la page Finance annonçait 5 000.
  const total = outstandingTotal([fee("a", 15000)], new Map([["a", 10000]]));
  assert.equal(total, 5000);
});

test("plusieurs frais s'additionnent, chacun net de ses paiements", () => {
  const total = outstandingTotal(
    [fee("a", 15000), fee("b", 7500), fee("c", 20000)],
    new Map([
      ["a", 10000],
      ["c", 20000],
    ]),
  );
  // 5 000 + 7 500 + 0
  assert.equal(total, 12500);
});

test("un frais sur-payé ne vient pas en déduction des autres", () => {
  const total = outstandingTotal(
    [fee("a", 5000), fee("b", 10000)],
    new Map([["a", 9000]]),
  );
  // Sans le plancher à zéro, le trop-perçu de 4 000 sur « a » aurait effacé
  // une partie de la dette réelle de « b » et affiché 6 000.
  assert.equal(total, 10000);
});

test("aucun frais en attente : le reste dû est nul, pas indéfini", () => {
  assert.equal(outstandingTotal([], new Map()), 0);
});

// ---------------------------------------------------------------------------
// Année scolaire attribuée à l'inscription
// ---------------------------------------------------------------------------

test("une école qui s'inscrit en août prépare la rentrée, pas l'année écoulée", () => {
  // Le bug : avec un seuil en septembre, une école inscrite le 19 août 2026
  // recevait « 2025-2026 », terminée le 30 juin 2026, et voyait dès sa
  // première connexion le bandeau « votre année scolaire est terminée ».
  const year = currentAcademicYear(new Date(2026, 7, 19));
  assert.equal(year.label, "2026-2027");
  assert.ok(year.endDate > new Date(2026, 7, 19), "l'année ne doit pas être déjà échue");
});

test("juillet bascule déjà sur la nouvelle année", () => {
  assert.equal(currentAcademicYear(new Date(2026, 6, 1)).label, "2026-2027");
});

test("juin appartient encore à l'année en cours", () => {
  assert.equal(currentAcademicYear(new Date(2026, 5, 15)).label, "2025-2026");
});

test("janvier appartient à l'année commencée en septembre précédent", () => {
  assert.equal(currentAcademicYear(new Date(2027, 0, 10)).label, "2026-2027");
});

test("l'année court du 1er septembre au 30 juin", () => {
  const year = currentAcademicYear(new Date(2026, 9, 5));
  assert.equal(year.startDate.getMonth(), 8);
  assert.equal(year.startDate.getDate(), 1);
  assert.equal(year.endDate.getMonth(), 5);
  assert.equal(year.endDate.getDate(), 30);
});
