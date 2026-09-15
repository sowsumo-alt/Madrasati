import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkFamilyParts,
  familyBalance,
  familyLabel,
  familySurname,
  familyTotal,
  parseAmount,
} from "../src/lib/family";

test("le nom saisi de la famille l'emporte, sinon « Famille » + nom du parent", () => {
  assert.equal(familyLabel({ familyName: "Famille BA", lastName: "Ba" }, "Famille {name}"), "Famille BA");
  assert.equal(familyLabel({ familyName: "  ", lastName: "Sow" }, "Famille {name}"), "Famille Sow");
  assert.equal(familyLabel({ familyName: null, lastName: "Sow" }, "عائلة {name}"), "عائلة Sow");
});

test("le nom des enfants se déduit du nom de la famille", () => {
  assert.equal(familySurname("Famille BA"), "BA");
  assert.equal(familySurname("  famille   Ould Ahmed "), "Ould Ahmed");
  assert.equal(familySurname("Sow family"), "Sow");
  assert.equal(familySurname("عائلة با"), "با");
  assert.equal(familySurname("Diallo"), "Diallo");
});

test("le total familial additionne les montants de chaque enfant", () => {
  assert.equal(familyTotal(["400", "500", "700"]), 1600);
  assert.equal(familyTotal([400, "", "700"]), 1100);
});

test("un montant vide, négatif ou illisible compte pour zéro pendant la saisie", () => {
  assert.equal(parseAmount(""), 0);
  assert.equal(parseAmount("-50"), 0);
  assert.equal(parseAmount("abc"), 0);
  assert.equal(parseAmount("1 500"), 1500);
});

test("le solde familial additionne les frais de tous les enfants", () => {
  assert.deepEqual(
    familyBalance([
      { amount: 400, totalPaid: 400 },
      { amount: 500, totalPaid: 200 },
      { amount: 700, totalPaid: 0 },
    ]),
    { billed: 1600, paid: 600, due: 1000 },
  );
});

test("un trop-perçu sur un enfant ne comble pas la dette d'un autre", () => {
  assert.equal(
    familyBalance([
      { amount: 400, totalPaid: 500 },
      { amount: 300, totalPaid: 0 },
    ]).due,
    300,
  );
});

test("les parts d'un paiement familial restent dans le reste dû de chaque frais", () => {
  const remaining = new Map([
    ["f1", 400],
    ["f2", 500],
  ]);
  assert.equal(checkFamilyParts([{ feeId: "f1", amount: 400 }, { feeId: "f2", amount: 100 }], remaining), null);
  assert.match(checkFamilyParts([{ feeId: "f1", amount: 0 }], remaining) ?? "", /au moins un montant/);
  assert.match(checkFamilyParts([{ feeId: "f2", amount: 600 }], remaining) ?? "", /dépasse/);
  assert.match(checkFamilyParts([{ feeId: "zz", amount: 10 }], remaining) ?? "", /introuvable/);
  assert.match(
    checkFamilyParts([{ feeId: "f1", amount: 10 }, { feeId: "f1", amount: 20 }], remaining) ?? "",
    /deux fois/,
  );
});
