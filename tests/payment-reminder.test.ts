import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_DUE_RULE, describeDueRule, dueRuleOf, effectiveDueDate, payByDate, withDueRule } from "../src/lib/due-rule";
import { balanceOf, formatMoney } from "../src/lib/money";
import { daysOverdue } from "../src/lib/payments-list";
import {
  reminderGroups,
  reminderMessage,
  reminderWhatsAppUrl,
  type ReminderFee,
  type ReminderParent,
  type ReminderStudent,
} from "../src/lib/payment-reminder";

const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const october = { dueDate: d("2026-10-01"), periodStart: d("2026-10-01") };
const isDue = (line: { dueDate: Date; periodStart: Date | null }, rule = DEFAULT_DUE_RULE, now: Date) =>
  balanceOf([{ amount: 1000, paid: 0, dueDate: effectiveDueDate(line, rule) }], now).due > 0;

// — La règle d'échéance

test("sans réglage, un mois se paie le 1er et devient dû le 2 à 0 h", () => {
  assert.equal(isDue(october, DEFAULT_DUE_RULE, d("2026-10-01T18:00:00Z")), false);
  assert.equal(isDue(october, DEFAULT_DUE_RULE, d("2026-10-02T00:00:00Z")), true);
});

test("jour limite le 5 et 3 jours de tolérance : à venir jusqu'au 8 au soir, impayé le 9", () => {
  const rule = { dueDay: 5, graceDays: 3 };
  assert.equal(payByDate(october, rule).toISOString().slice(0, 10), "2026-10-05");
  assert.equal(isDue(october, rule, d("2026-10-08T23:59:00Z")), false);
  assert.equal(isDue(october, rule, d("2026-10-09T00:00:00Z")), true);
  // Le premier jour d'impayé compte 1 jour de retard.
  const fee = { amount: 1000, totalPaid: 0, dueDate: effectiveDueDate(october, rule) };
  assert.equal(daysOverdue(fee, d("2026-10-09T10:00:00Z")), 1);
  assert.equal(
    describeDueRule(rule, d("2026-10-07")),
    "Octobre se paie au plus tard le 5 octobre, avec 3 jours de tolérance ; non réglé, il devient impayé le 9 octobre.",
  );
});

test("le mois d'entrée se paie avec l'échéance du mois suivant", () => {
  // Inscrit en octobre : l'échéance d'octobre est enregistrée au 1er novembre.
  const entry = { dueDate: d("2026-11-01"), periodStart: d("2026-10-01") };
  const rule = { dueDay: 5, graceDays: 0 };
  assert.equal(isDue(entry, rule, d("2026-11-05T20:00:00Z")), false);
  assert.equal(isDue(entry, rule, d("2026-11-06T00:00:00Z")), true);
});

test("les frais hors scolarité gardent leur échéance ; une date posée à la main plus tard est respectée", () => {
  const enrollment = { dueDate: d("2026-10-03T14:30:00Z"), periodStart: null };
  assert.equal(effectiveDueDate(enrollment, { dueDay: 10, graceDays: 5 }).toISOString(), "2026-10-03T14:30:00.000Z");
  const manual = { dueDate: d("2026-10-15"), periodStart: d("2026-10-01") };
  assert.equal(payByDate(manual, { dueDay: 5, graceDays: 0 }).toISOString().slice(0, 10), "2026-10-15");
  assert.equal(withDueRule(manual, { dueDay: 5, graceDays: 0 }).dueDate.toISOString(), "2026-10-15T23:59:59.999Z");
});

test("un réglage hors limites est borné, un réglage absent vaut le 1er sans tolérance", () => {
  assert.deepEqual(dueRuleOf({ paymentDueDay: 40, paymentGraceDays: -2 }), { dueDay: 28, graceDays: 0 });
  assert.deepEqual(dueRuleOf(null), DEFAULT_DUE_RULE);
});

// — Les rappels du mois

const now = d("2026-10-10T09:00:00Z");
const month = (iso: string) => ({ dueDate: d(iso), periodStart: d(iso) });
const students: ReminderStudent[] = [
  { id: "tahra", name: "Tahra Sall", className: "3AF", active: true, parentId: "p-sall" },
  { id: "hadrami", name: "Hadrami Sall", className: "1AF", active: true, parentId: "p-sall" },
  { id: "awa", name: "Awa Ba", className: "CP", active: true, parentId: "p-ba" },
  { id: "ali", name: "Ali Diop", className: "2AF", active: true, parentId: "p-diop" },
  { id: "binta", name: "Binta Diop", className: "4AF", active: true, parentId: "p-diop" },
  { id: "seul", name: "Moussa Kane", className: null, active: true, parentId: null },
];
const parents: ReminderParent[] = [
  { id: "p-sall", name: "Mariem Sall", phone: "+22246000001" },
  { id: "p-ba", name: "Oumar Ba", phone: "+22246000002" },
  { id: "p-diop", name: "Fatou Diop", phone: "+22246000003" },
];
const fees: ReminderFee[] = [
  // Famille Sall : fiche familiale portée par Tahra.
  { studentId: "tahra", label: "Frais d'inscription — 2026-2027", amount: 400, paid: 100, dueDate: d("2026-09-20"), periodStart: null, familyParentId: "p-sall" },
  { studentId: "tahra", label: "Frais de scolarité — Octobre 2026", amount: 1600, paid: 0, ...month("2026-10-01"), familyParentId: "p-sall" },
  { studentId: "tahra", label: "Frais de scolarité — Novembre 2026", amount: 1600, paid: 0, ...month("2026-11-01"), familyParentId: "p-sall" },
  { studentId: "tahra", label: "Frais de scolarité — Juin 2027", amount: 1600, paid: 1600, ...month("2027-06-01"), familyParentId: "p-sall" },
  // Awa : octobre en partie payé ; un trop-perçu sur septembre ne comble pas octobre.
  { studentId: "awa", label: "Frais de scolarité — Septembre 2026", amount: 1000, paid: 1500, ...month("2026-09-01"), familyParentId: null },
  { studentId: "awa", label: "Frais de scolarité — Octobre 2026", amount: 1000, paid: 400, ...month("2026-10-01"), familyParentId: null },
  // Famille Diop, une fiche par enfant : octobre dû pour les deux.
  { studentId: "ali", label: "Frais de scolarité — Septembre 2026", amount: 500, paid: 0, ...month("2026-09-01"), familyParentId: null },
  { studentId: "ali", label: "Frais de scolarité — Octobre 2026", amount: 500, paid: 0, ...month("2026-10-01"), familyParentId: null },
  { studentId: "binta", label: "Frais de scolarité — Octobre 2026", amount: 700, paid: 0, ...month("2026-10-01"), familyParentId: null },
  // Payé d'avance : juin réglé, rien d'autre de dû.
  { studentId: "seul", label: "Frais de scolarité — Juin 2027", amount: 800, paid: 800, ...month("2027-06-01"), familyParentId: null },
  { studentId: "seul", label: "Frais de scolarité — Octobre 2026", amount: 800, paid: 800, ...month("2026-10-01"), familyParentId: null },
];

const groups = reminderGroups({ fees, students, parents, rule: { dueDay: 5, graceDays: 3 }, now });
const byKey = new Map(groups.map((g) => [g.key, g]));

test("rappels : le montant exact dû par famille, mois par mois", () => {
  assert.deepEqual([...byKey.keys()].sort(), ["p-ba", "p-diop", "p-sall"]);
  assert.deepEqual(byKey.get("p-sall")!.lines, [
    { label: "Frais d'inscription — 2026-2027", amount: 300 },
    { label: "Octobre 2026", amount: 1600 },
  ]);
  assert.equal(byKey.get("p-sall")!.total, 1900);
  // Fiche familiale : les deux enfants sont nommés.
  assert.deepEqual(byKey.get("p-sall")!.children.map((c) => c.id), ["hadrami", "tahra"]);
  assert.deepEqual(byKey.get("p-ba")!.lines, [{ label: "Octobre 2026", amount: 600 }]);
  // Deux enfants dus pour octobre : une ligne, au total des deux.
  assert.deepEqual(byKey.get("p-diop")!.lines, [
    { label: "Septembre 2026", amount: 500 },
    { label: "Octobre 2026", amount: 1200 },
  ]);
});

test("rappels : un mois payé d'avance ou pas encore arrivé n'apparaît jamais", () => {
  const labels = groups.flatMap((g) => g.lines.map((l) => l.label));
  assert.ok(!labels.includes("Juin 2027"));
  assert.ok(!labels.includes("Novembre 2026"));
  assert.equal(byKey.has("seul"), false);
  assert.equal(byKey.has("student:seul"), false);
  // Avant le 9 octobre (le 5 + 3 jours), octobre n'est pas encore dû.
  const early = reminderGroups({ fees, students, parents, rule: { dueDay: 5, graceDays: 3 }, now: d("2026-10-08T20:00:00Z") });
  assert.ok(!early.flatMap((g) => g.lines.map((l) => l.label)).includes("Octobre 2026"));
});

test("le message nomme le parent, les enfants, chaque mois et le montant exact", () => {
  const message = reminderMessage(byKey.get("p-sall")!, { schoolName: "École  NGLAM", unit: "MRU" });
  assert.match(message, /^Bonjour Mariem Sall,/);
  assert.ok(message.includes("pour Hadrami Sall (1AF) et Tahra Sall (3AF)"));
  assert.ok(message.includes(`• Octobre 2026 : ${formatMoney(1600, "MRU")}`));
  assert.ok(message.includes(`Montant dû : ${formatMoney(1900, "MRU")}.`));
  assert.ok(message.includes("École NGLAM"));
  const mro = reminderMessage(byKey.get("p-ba")!, { schoolName: "IBDAA 2", unit: "MRO" });
  assert.ok(mro.includes(`Montant dû : ${formatMoney(600, "MRO")}.`));
  assert.match(mro, /6\s000 MRO \(600 MRU\)/);
});

test("le montant n'est jamais vide dans le message", () => {
  // Beaucoup de situations tirées au hasard (graine fixe) : chaque rappel
  // produit porte un montant chiffré, jamais vide, nul ou « NaN ».
  let seed = 7;
  const rand = (n: number) => ((seed = (seed * 16807) % 2147483647), seed % n);
  for (let round = 0; round < 200; round++) {
    const randomFees: ReminderFee[] = students.flatMap((s) =>
      ["2026-09-01", "2026-10-01", "2026-11-01", "2027-06-01"].map((m) => {
        const amount = [0, 1, 500, 1600, 2500][rand(5)];
        return {
          studentId: s.id,
          label: `Frais de scolarité — ${m}`,
          amount,
          paid: [0, amount, Math.floor(amount / 2), amount + 300][rand(4)],
          ...month(m),
          familyParentId: rand(3) === 0 ? s.parentId : null,
        };
      }),
    );
    const rule = { dueDay: 1 + rand(28), graceDays: rand(10) };
    for (const group of reminderGroups({ fees: randomFees, students, parents, rule, now })) {
      assert.ok(group.total > 0);
      for (const unit of ["MRU", "MRO"] as const) {
        const message = reminderMessage(group, { schoolName: "École", unit });
        assert.ok(message.includes(`Montant dû : ${formatMoney(group.total, unit)}.`));
        assert.match(message, /Montant dû : \d/);
        assert.doesNotMatch(message, /undefined|NaN|null|: (MRU|MRO)|Montant dû : 0\D/);
        for (const line of group.lines) assert.ok(line.amount > 0);
      }
    }
  }
  // Rien à payer : pas de message du tout, plutôt qu'un rappel « de  MRU ».
  assert.throws(() =>
    reminderMessage(
      { key: "x", parentId: null, parentName: "X", phone: null, children: [], lines: [], total: 0, oldestDue: now },
      { schoolName: "École", unit: "MRU" },
    ),
  );
});

test("le lien WhatsApp porte le numéro complet et le message exact", () => {
  const message = reminderMessage(byKey.get("p-ba")!, { schoolName: "École", unit: "MRU" });
  const url = reminderWhatsAppUrl("46 00 00 02", message);
  assert.ok(url.startsWith("https://wa.me/22246000002?text="));
  assert.equal(decodeURIComponent(url.split("?text=")[1]), message);
  assert.ok(reminderWhatsAppUrl("+222 46 00 00 02", message).startsWith("https://wa.me/22246000002?"));
});
