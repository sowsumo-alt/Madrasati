import { test } from "node:test";
import assert from "node:assert/strict";

import { formatPhone } from "../src/lib/format";

/** Un numéro s'écrit par groupes de deux chiffres, comme sur les reçus papier. */

test("un numéro mauritanien est groupé par deux chiffres", () => {
  assert.equal(formatPhone("+22246523896"), "+222 46 52 38 96");
  assert.equal(formatPhone("+222 46523896"), "+222 46 52 38 96");
});

test("un numéro d'un autre format est rendu tel quel, sans rien inventer", () => {
  assert.equal(formatPhone("+33612345678"), "+33612345678");
  assert.equal(formatPhone("46523896"), "46523896");
  assert.equal(formatPhone("+2224652389"), "+2224652389");
});
