import { test } from "node:test";
import assert from "node:assert/strict";

import {
  manualVariables,
  personalize,
  sourceFromEdited,
  type PersonalRecipient,
} from "../src/lib/message-personalize";

const context = { today: new Date("2026-09-28T10:00:00Z"), schoolName: "École NGLAM" };
const reminder = {
  fr: "Bonjour {parentName}, frais de {amount} MRU pour {studentName}, échéance au {date}.",
  ar: "مرحبًا {parentName}، مبلغ {amount} أوقية لـ {studentName}، بتاريخ {date}.",
};

const awa: PersonalRecipient = {
  name: "Awa Ba",
  kind: "PARENT",
  children: [
    { name: "Aminata Ba", outstanding: 15000, oldestDue: "2026-09-01T00:00:00.000Z" },
    { name: "Ousmane Ba", outstanding: 5000, oldestDue: "2026-09-15T00:00:00.000Z" },
  ],
};
const sidi: PersonalRecipient = {
  name: "Sidi Diallo",
  kind: "PARENT",
  children: [{ name: "Moussa Diallo", outstanding: 3000, oldestDue: "2026-09-10T00:00:00.000Z" }],
};
const upToDate: PersonalRecipient = {
  name: "Fatou Sow",
  kind: "PARENT",
  children: [{ name: "Khady Sow", outstanding: 0, oldestDue: null }],
};

test("chaque parent reçoit son nom, ses enfants, son montant et sa date, dans les deux langues", () => {
  const a = personalize(reminder, awa, context).text;
  assert.match(a, /Bonjour Awa Ba, frais de 20\s000 MRU pour Aminata Ba et Ousmane Ba, échéance au 1 septembre 2026\./);
  assert.match(a, /مرحبًا Awa Ba، مبلغ 20\s000 أوقية لـ Aminata Ba و Ousmane Ba/);

  const s = personalize(reminder, sidi, context).text;
  assert.match(s, /Bonjour Sidi Diallo, frais de 3\s000 MRU pour Moussa Diallo/);
  assert.doesNotMatch(s, /Awa|20\s000/);
});

test("un parent à jour n'a pas de montant : il est signalé, pas envoyé avec un trou", () => {
  assert.deepEqual(personalize(reminder, upToDate, context).missingAuto, ["amount"]);
  assert.deepEqual(personalize(reminder, awa, context).missingAuto, []);
});

test("une saisie manuelle ne remplace jamais le montant d'un parent", () => {
  const text = personalize(reminder, sidi, context, { amount: "99 999" }).text;
  assert.match(text, /3\s000 MRU/);
  const alert = { fr: "Alerte : {reason}.", ar: null };
  assert.deepEqual(manualVariables(alert), ["reason"]);
  assert.equal(personalize(alert, sidi, context, { reason: "absence" }).text, "Alerte : absence.");
});

test("un texte retouché garde les variables : chaque parent reçoit le sien", () => {
  const shown = personalize(reminder, awa, context).text;
  const edited = shown.replace("Bonjour", "Bonsoir");
  const source = sourceFromEdited(edited, awa, context);
  assert.match(source.fr, /^Bonsoir \{parentName\}, frais de \{amount\} MRU pour \{studentName\}, échéance au \{date\}\.$/);
  const forSidi = personalize(source, sidi, context).text;
  assert.match(forSidi, /Bonsoir Sidi Diallo, frais de 3\s000 MRU pour Moussa Diallo/);
  assert.match(forSidi, /مرحبًا Sidi Diallo، مبلغ 3\s000 أوقية لـ Moussa Diallo/);
});
