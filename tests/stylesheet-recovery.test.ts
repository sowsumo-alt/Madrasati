import { test } from "node:test";
import assert from "node:assert/strict";

import { STYLESHEET_RECOVERY_SCRIPT, STYLE_RELOAD_GUARD_MS } from "../src/lib/stylesheet-recovery";

/** Navigateur simulé : écouteurs, liens de style, sessionStorage et rechargements comptés. */
function browser({ links = [] as { sheet: object | null }[], storage = new Map<string, string>() } = {}) {
  const listeners: Record<string, ((e: { target?: unknown }) => void)[]> = {};
  const env = {
    reloads: 0,
    storage,
    window: { addEventListener: (type: string, fn: (e: { target?: unknown }) => void) => (listeners[type] ??= []).push(fn) },
    document: { querySelectorAll: () => links },
    sessionStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) },
    location: { reload: () => void env.reloads++ },
    fire: (type: string, target?: unknown) => (listeners[type] ?? []).forEach((fn) => fn({ target })),
  };
  new Function("window", "document", "sessionStorage", "location", STYLESHEET_RECOVERY_SCRIPT)(
    env.window, env.document, env.sessionStorage, env.location,
  );
  return env;
}

test("un fichier de style introuvable (page ouverte pendant une mise à jour) recharge la page", () => {
  const b = browser();
  b.fire("error", { tagName: "LINK", rel: "stylesheet" });
  assert.equal(b.reloads, 1);
});

test("style absent au chargement complet : rechargement", () => {
  const b = browser({ links: [{ sheet: {} }, { sheet: null }] });
  b.fire("load");
  assert.equal(b.reloads, 1);
});

test("tout est chargé, ou l'erreur vient d'une image : aucun rechargement", () => {
  const b = browser({ links: [{ sheet: {} }] });
  b.fire("load");
  b.fire("error", { tagName: "IMG" });
  assert.equal(b.reloads, 0);
});

test("pas de boucle : un seul rechargement dans les 30 secondes", () => {
  const storage = new Map<string, string>();
  const first = browser({ storage });
  first.fire("error", { tagName: "LINK", rel: "stylesheet" });
  const second = browser({ storage });
  second.fire("error", { tagName: "LINK", rel: "stylesheet" });
  assert.equal(first.reloads + second.reloads, 1);
  storage.set("madrasati:recharge-style", String(Date.now() - STYLE_RELOAD_GUARD_MS - 1));
  const later = browser({ storage });
  later.fire("error", { tagName: "LINK", rel: "stylesheet" });
  assert.equal(later.reloads, 1);
});
