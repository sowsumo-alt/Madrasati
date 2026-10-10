import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { clearAllDrafts, loadDraft, saveDraft } from "../src/lib/form-draft";

// Stockage du navigateur simulé (les brouillons vivent dans window.localStorage).
const store = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
(globalThis as unknown as { window: unknown }).window = { localStorage };

beforeEach(() => store.clear());

test("un brouillon d'inscription récent est repris", () => {
  saveDraft("eleve-ecole1", { firstName: "Aminata" });
  assert.deepEqual(loadDraft<{ firstName: string }>("eleve-ecole1")?.data, { firstName: "Aminata" });
});

test("un brouillon de plus de 7 jours est effacé, jamais repris", () => {
  store.set("madrasati:brouillon:eleve-ecole1", JSON.stringify({ data: { firstName: "Aminata" }, savedAt: Date.now() - 8 * 86_400_000 }));
  assert.equal(loadDraft("eleve-ecole1"), null);
  assert.equal(store.has("madrasati:brouillon:eleve-ecole1"), false);
});

test("la déconnexion efface tous les brouillons (données d'enfants), et rien d'autre", () => {
  saveDraft("eleve-ecole1", { nni: "1234567890" });
  saveDraft("famille-ecole1", { parentPhone: "22246000001" });
  store.set("madrasati-remember-email", "directeur@ecole.mr");
  clearAllDrafts();
  assert.deepEqual([...store.keys()], ["madrasati-remember-email"]);
});
