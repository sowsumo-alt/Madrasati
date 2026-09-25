import { test } from "node:test";
import assert from "node:assert/strict";

import { parseHonors, suggestDecision } from "../src/lib/annual-decision";

test("la décision suggérée suit le seuil de l'école", () => {
  assert.equal(suggestDecision(12.89, 10), "PROMOTED");
  assert.equal(suggestDecision(10, 10), "PROMOTED"); // le seuil lui-même suffit
  assert.equal(suggestDecision(9.99, 10), "REPEAT");
  // Une école plus exigeante : même moyenne, autre suggestion.
  assert.equal(suggestDecision(12.89, 13), "REPEAT");
  assert.equal(suggestDecision(null, 10), null);
});

test("les mentions enregistrées sont relues sans faire confiance à leur format", () => {
  assert.deepEqual(parseHonors(["FELICITATIONS", "INCONNU", 3]), ["FELICITATIONS"]);
  assert.deepEqual(parseHonors("FELICITATIONS"), []);
  assert.deepEqual(parseHonors(null), []);
});
