import { test } from "node:test";
import assert from "node:assert/strict";

import { isRealIsoDate } from "../src/lib/iso-date";
import { studentSchema } from "../src/app/directeur/eleves/schema";
import { familyChildSchema } from "../src/app/directeur/familles/schema";

const base = { firstName: "Awa", lastName: "Ba", gender: "F", classId: "c1", status: "ACTIVE" };
const ok = (over: Record<string, unknown>) => studentSchema.safeParse({ ...base, ...over }).success;

test("une date impossible n'existe pas (31/02 ne devient jamais le 2 mars)", () => {
  assert.equal(isRealIsoDate("2012-02-31"), false);
  assert.equal(isRealIsoDate("2013-02-29"), false);
  assert.equal(isRealIsoDate("2012-02-29"), true);
  assert.equal(isRealIsoDate("12/03/2012"), false);
  assert.equal(isRealIsoDate("abc"), false);
});

test("fiche élève : date de naissance réelle et passée, inscription plausible", () => {
  assert.equal(ok({ dateOfBirth: "2012-02-31" }), false);
  assert.equal(ok({ dateOfBirth: "pas une date" }), false);
  assert.equal(ok({ dateOfBirth: "2999-01-01" }), false, "naissance dans le futur");
  assert.equal(ok({ dateOfBirth: "1900-01-01" }), false);
  assert.equal(ok({ dateOfBirth: "2012-03-15" }), true);
  assert.equal(ok({ dateOfBirth: "" }), true);
  assert.equal(ok({ enrollmentDate: "2026-09-31" }), false);
  assert.equal(ok({ enrollmentDate: "2026-09-01" }), true);
});

test("noms : 80 caractères au plus", () => {
  assert.equal(ok({ firstName: "A".repeat(81) }), false);
  assert.equal(ok({ firstName: "A".repeat(80) }), true);
});

test("inscription d'une famille : même contrôle de date pour chaque enfant", () => {
  const child = { firstName: "Awa", lastName: "Ba", gender: "F", classId: "c1", amount: 0 };
  assert.equal(familyChildSchema.safeParse({ ...child, dateOfBirth: "2012-02-31" }).success, false);
  assert.equal(familyChildSchema.safeParse({ ...child, dateOfBirth: "2012-02-28" }).success, true);
});
