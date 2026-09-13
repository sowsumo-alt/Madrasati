import { test } from "node:test";
import assert from "node:assert/strict";

import { joinFullName, pageNumbers, splitFullName } from "../src/lib/student-form";

/**
 * Le formulaire élève demande le nom du parent en un seul champ, mais la fiche
 * parent le garde en deux parties : l'aller-retour ne doit rien perdre.
 */

test("le nom complet du parent se découpe au premier espace", () => {
  assert.deepEqual(splitFullName("Mohamed Ould Ahmed"), {
    firstName: "Mohamed",
    lastName: "Ould Ahmed",
  });
  assert.deepEqual(splitFullName("  Fatimata  "), { firstName: "Fatimata", lastName: "" });
  assert.deepEqual(splitFullName("   "), { firstName: "", lastName: "" });
});

test("le nom recomposé en modification est celui qui avait été saisi", () => {
  const { firstName, lastName } = splitFullName("Sidi  Mohamed   Ould Bah");
  assert.equal(joinFullName(firstName, lastName), "Sidi Mohamed Ould Bah");
  assert.equal(joinFullName("Fatimata", ""), "Fatimata");
  assert.equal(joinFullName(null, null), "");
});

test("la pagination garde les bords et la page courante, avec des « … »", () => {
  assert.deepEqual(pageNumbers(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageNumbers(1, 12), [1, 2, "…", 12]);
  assert.deepEqual(pageNumbers(6, 12), [1, "…", 5, 6, 7, "…", 12]);
  assert.deepEqual(pageNumbers(12, 12), [1, "…", 11, 12]);
  assert.deepEqual(pageNumbers(1, 0), []);
});
