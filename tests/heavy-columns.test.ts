import { test } from "node:test";
import assert from "node:assert/strict";
import { HEAVY_COLUMNS } from "../src/lib/prisma";

// Photos et logos (images encodées) : jamais transférés depuis la base sans être demandés.
test("photo de l'élève et logo de l'école exclus par défaut de toutes les lectures", () => {
  assert.equal(HEAVY_COLUMNS.student.photoUrl, true);
  assert.equal(HEAVY_COLUMNS.school.logoUrl, true);
});
