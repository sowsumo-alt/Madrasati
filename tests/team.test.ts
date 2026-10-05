import { test } from "node:test";
import assert from "node:assert/strict";

import { accessLabel, normalizeEmail, teamRefusal } from "../src/lib/team";
import { INACTIVE_MESSAGE, READ_ONLY_MESSAGE, writeRefusal } from "../src/lib/write-guard";

const owner = { id: "o", schoolId: "s", role: "DIRECTOR", isOwner: true };
const associate = { id: "a", schoolId: "s", role: "DIRECTOR", isOwner: false };
const other = { id: "b", schoolId: "s", role: "DIRECTOR", isOwner: false };
const teacher = { id: "t", schoolId: "s", role: "TEACHER", isOwner: false };

test("seul le directeur principal gère les autres directeurs", () => {
  assert.equal(teamRefusal(owner, associate), null);
  assert.match(teamRefusal(associate, other)!, /Seul le directeur principal/);
  // Un associé ne peut pas toucher au compte du directeur principal (ni le principal à lui-même ici).
  assert.match(teamRefusal(associate, owner)!, /Seul le directeur principal/);
  assert.match(teamRefusal(owner, owner)!, /Mon compte/);
});

test("enseignants et parents : tout directeur les gère ; une autre école, jamais", () => {
  assert.equal(teamRefusal(associate, teacher), null);
  assert.equal(teamRefusal(owner, { ...teacher, schoolId: "autre" }), "Compte introuvable.");
  assert.equal(teamRefusal(owner, null), "Compte introuvable.");
});

test("lecture seule : aucune écriture, sauf son propre mot de passe", () => {
  const readOnly = { role: "DIRECTOR", access: "READ_ONLY", isActive: true };
  assert.equal(writeRefusal(readOnly, { model: "Payment", selfUpdate: false }), READ_ONLY_MESSAGE);
  assert.equal(writeRefusal(readOnly, { model: "Student", selfUpdate: false }), READ_ONLY_MESSAGE);
  assert.equal(writeRefusal(readOnly, { model: "User", selfUpdate: true }), null);
  assert.equal(writeRefusal(readOnly, { model: "User", selfUpdate: false }), READ_ONLY_MESSAGE);
});

test("directeur complet : tout ; accès retiré : rien ; hors école (inscription) : rien à contrôler", () => {
  assert.equal(writeRefusal({ role: "DIRECTOR", access: "FULL", isActive: true }, { model: "Payment", selfUpdate: false }), null);
  assert.equal(writeRefusal({ role: "DIRECTOR", access: "FULL", isActive: false }, { model: "Payment", selfUpdate: false }), INACTIVE_MESSAGE);
  assert.equal(writeRefusal({ role: "TEACHER", access: "FULL", isActive: true }, { model: "Grade", selfUpdate: false }), null);
  assert.equal(writeRefusal(null, { model: "School", selfUpdate: false }), null);
});

test("libellés et e-mails", () => {
  assert.equal(accessLabel({ isOwner: true, access: "FULL" }), "Directeur principal");
  assert.equal(accessLabel({ isOwner: false, access: "FULL" }), "Directeur");
  assert.equal(accessLabel({ isOwner: false, access: "READ_ONLY" }), "Lecture seule");
  assert.equal(normalizeEmail("  Aminata.Sow@Gmail.com "), "aminata.sow@gmail.com");
  assert.equal(normalizeEmail("aminata@gmail"), null);
  assert.equal(normalizeEmail("pas un email"), null);
});
