import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidNni, optionalNniSchema, storedNni } from "../src/lib/nni";

test("un NNI compte 10 chiffres ; espaces et tirets tolérés à la saisie", () => {
  assert.equal(isValidNni("1234567890"), true);
  assert.equal(isValidNni("12 3456 7890"), true);
  assert.equal(isValidNni("123456789"), false);
  assert.equal(isValidNni("12345678901"), false);
  assert.equal(isValidNni("12345A7890"), false);
  assert.equal(storedNni("12 3456-7890"), "1234567890");
  assert.equal(storedNni(""), null);
});

test("le NNI reste facultatif dans les formulaires", () => {
  assert.equal(optionalNniSchema.safeParse("").success, true);
  assert.equal(optionalNniSchema.safeParse(undefined).success, true);
  assert.equal(optionalNniSchema.safeParse("12345").success, false);
});
