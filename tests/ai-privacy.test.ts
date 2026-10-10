import { test } from "node:test";
import assert from "node:assert/strict";

import { AI_STUDENT_CODE, aiPrompt, cleanAppreciation } from "../src/lib/ai";
import type { ReportCard } from "../src/lib/report-card-compute";

// Bulletin minimal : seuls les champs lus par le prompt comptent.
const card = {
  student: { id: "s1", firstName: "Mohamed Lemine", lastName: "Ould Ahmed" },
  className: "1AS",
  term: "Trimestre 1",
  average: 14.25,
  mention: "VERY_GOOD",
  rank: 3,
  classSize: 30,
  attendance: { present: 40, absent: 2, late: 1 },
  results: [{ subjectName: "Mathématiques", coefficient: 4, average: 15, classAverage: 11.5 }],
} as unknown as ReportCard;

test("rien de l'identité de l'élève ne part chez Google : un code à la place du nom", () => {
  const prompt = aiPrompt(card);
  assert.ok(!prompt.includes("Mohamed"), "prénom envoyé");
  assert.ok(!prompt.includes("Ould Ahmed"), "nom envoyé");
  assert.ok(prompt.includes(AI_STUDENT_CODE));
  assert.ok(prompt.includes("Mathématiques"));
});

test("le code ne reste jamais dans l'appréciation rendue", () => {
  assert.equal(cleanAppreciation(`${AI_STUDENT_CODE} progresse en mathématiques.`, "fr"), "L'élève progresse en mathématiques.");
  assert.equal(cleanAppreciation(`Bon trimestre pour ${AI_STUDENT_CODE}.`, "fr"), "Bon trimestre pour l'élève.");
  assert.equal(cleanAppreciation(`يتقدم ${AI_STUDENT_CODE} في الرياضيات.`, "ar"), "يتقدم التلميذ في الرياضيات.");
});
