import { test } from "node:test";
import assert from "node:assert/strict";

import { cleanMatricule, formatMatricule, highestRank, nextMatricules } from "../src/lib/student-number";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

test("matricule : année d'inscription et rang sur quatre chiffres", () => {
  assert.equal(formatMatricule(2026, 1), "2026-0001");
  assert.equal(formatMatricule(2026, 42), "2026-0042");
  assert.equal(formatMatricule(2026, 12345), "2026-12345"); // jamais tronqué
});

test("le suivant prend la suite de l'année, sans se laisser tromper par un numéro modifié", () => {
  const taken = ["2026-0001", "2026-0007", "2025-0040", "ANCIEN-12", null];
  assert.equal(highestRank(taken, 2026), 7);
  assert.equal(highestRank(taken, 2024), 0);
  assert.deepEqual(nextMatricules(taken, [d("2026-10-01"), d("2026-10-02"), d("2025-09-15")]), [
    "2026-0008",
    "2026-0009",
    "2025-0041",
  ]);
});

test("une nouvelle année recommence à 0001", () => {
  assert.deepEqual(nextMatricules(["2026-0300"], [d("2027-09-20")]), ["2027-0001"]);
});

test("saisie du directeur : espaces retirés, vide = automatique", () => {
  assert.equal(cleanMatricule("  E-104 "), "E-104");
  assert.equal(cleanMatricule("   "), null);
  assert.equal(cleanMatricule(undefined), null);
});
