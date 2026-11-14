import { test } from "node:test";
import assert from "node:assert/strict";

import { feeSchema } from "../src/app/directeur/finance/schema";
import { incidentSchema } from "../src/app/directeur/discipline/schema";

test("échéance d'un frais : une vraie date, jamais déplacée (31/09 refusé)", () => {
  const fee = { studentId: "s1", label: "Frais", amount: 1000 };
  assert.equal(feeSchema.safeParse({ ...fee, dueDate: "2026-09-31" }).success, false);
  assert.equal(feeSchema.safeParse({ ...fee, dueDate: "demain" }).success, false);
  assert.equal(feeSchema.safeParse({ ...fee, dueDate: "2026-10-01" }).success, true);
});

test("incident de discipline : date réelle, pas dans le futur lointain", () => {
  const incident = { studentId: "s1", type: "WARNING", description: "Retard" };
  assert.equal(incidentSchema.safeParse({ ...incident, date: "2026-02-30" }).success, false);
  assert.equal(incidentSchema.safeParse({ ...incident, date: "2999-01-01" }).success, false);
  assert.equal(incidentSchema.safeParse({ ...incident, date: "2026-10-07" }).success, true);
});
