import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_TEMPLATES } from "../src/lib/school-setup";
import {
  extractVariables,
  fillTemplate,
  fillTemplateChecked,
  withArabic,
  schoolSignatureFr,
  schoolSignatureAr,
} from "../src/lib/whatsapp";

/**
 * Garde-fou du défaut le plus grave rencontré : le modèle « Rappel de
 * paiement » partait avec « frais de scolarité de  MRU », montant vide, en
 * français comme en arabe. Ces tests parcourent TOUS les modèles livrés, dans
 * les deux langues, pour qu'un trou de variable ne puisse pas réapparaître
 * ailleurs sans être vu.
 */

/** Valeur plausible pour chaque variable connue. */
const SAMPLE: Record<string, string> = {
  parentName: "Ahmed Ould Sidi",
  teacherName: "Khadijetou Mint Ely",
  studentName: "Mariama Sy",
  schoolName: "École Al Amal",
  amount: "7 000",
  date: "18 août 2026",
  average: "13,50",
  reason: "présence à 33 % ce mois-ci",
};

const LANGS = [
  { name: "français", pick: (t: (typeof DEFAULT_TEMPLATES)[number]) => t.body },
  { name: "arabe", pick: (t: (typeof DEFAULT_TEMPLATES)[number]) => t.bodyAr },
] as const;

for (const tpl of DEFAULT_TEMPLATES) {
  for (const lang of LANGS) {
    const body = lang.pick(tpl);

    test(`${tpl.key} (${lang.name}) — toutes les variables sont connues`, () => {
      for (const v of extractVariables(body)) {
        assert.ok(
          v in SAMPLE,
          `Variable {${v}} inconnue : ajoutez-la à SAMPLE et au remplissage réel, sinon elle partira vide.`,
        );
      }
    });

    test(`${tpl.key} (${lang.name}) — rempli complètement, rien ne manque`, () => {
      const { text, missing } = fillTemplateChecked(body, SAMPLE);
      assert.deepEqual(missing, [], `Variables non renseignées : ${missing.join(", ")}`);
      assert.ok(!/\{\w+\}/.test(text), `Placeholder restant dans : ${text}`);
      assert.ok(!/ {2,}/.test(text), `Double espace dans : ${text}`);
    });

    test(`${tpl.key} (${lang.name}) — une variable vide est detectee, pas envoyee`, () => {
      const vars = extractVariables(body).filter(
        (v) => v !== "schoolName" && v !== "date",
      );
      if (vars.length === 0) return; // modèle sans donnée dépendante du destinataire

      for (const v of vars) {
        const { text, missing } = fillTemplateChecked(body, { ...SAMPLE, [v]: "" });
        assert.ok(
          missing.includes(v),
          `{${v}} vide n'a pas été signalé — le message partirait incomplet.`,
        );
        // Même signalée, la sortie ne doit pas exhiber de double espace.
        assert.ok(!/ {2,}/.test(text), `Double espace laissé par {${v}} vide : ${text}`);
      }
    });
  }
}

test("le montant vide du rappel de paiement est bien bloque (cas de l'audit)", () => {
  const tpl = DEFAULT_TEMPLATES.find((t) => t.key === "PAYMENT_REMINDER");
  assert.ok(tpl, "Modèle PAYMENT_REMINDER introuvable");

  const values = { ...SAMPLE, amount: "" };
  const fr = fillTemplateChecked(tpl!.body, values);
  const ar = fillTemplateChecked(tpl!.bodyAr, values);

  assert.ok(fr.missing.includes("amount"), "Montant vide non détecté en français");
  assert.ok(ar.missing.includes("amount"), "Montant vide non détecté en arabe");
  assert.ok(!/de {2,}MRU/.test(fr.text), "Le double espace du bug d'origine est revenu");
  assert.ok(!/ {2,}/.test(ar.text), "Double espace côté arabe");
});

test("un montant renseigne produit un message complet et lisible", () => {
  const tpl = DEFAULT_TEMPLATES.find((t) => t.key === "PAYMENT_REMINDER")!;
  const { text, missing } = fillTemplateChecked(tpl.body, SAMPLE);
  assert.deepEqual(missing, []);
  assert.ok(text.includes("7 000 MRU"), `Montant absent du message : ${text}`);
});

test("la signature n'ecrit jamais « Ecole Ecole X »", () => {
  assert.equal(schoolSignatureFr("École Al Amal"), "École Al Amal");
  assert.equal(schoolSignatureFr("Al Amal"), "École Al Amal");
  assert.equal(schoolSignatureAr("مدرسة الأمل"), "مدرسة الأمل");
  assert.equal(schoolSignatureAr("الأمل"), "مدرسة الأمل");
});

test("withArabic joint les deux langues, et se tait sans traduction", () => {
  assert.equal(withArabic("Bonjour", "مرحبا"), "Bonjour\n————————\nمرحبا");
  assert.equal(withArabic("Bonjour", null), "Bonjour");
  assert.equal(withArabic("Bonjour", "   "), "Bonjour");
});

test("fillTemplate ne laisse pas de double espace ni d'espace en fin de ligne", () => {
  assert.equal(fillTemplate("de {amount} MRU", { amount: "" }), "de MRU");
  assert.equal(fillTemplate("Total : {amount}", { amount: "" }), "Total :");
  assert.equal(fillTemplate("de {amount} MRU", { amount: "500" }), "de 500 MRU");
});
