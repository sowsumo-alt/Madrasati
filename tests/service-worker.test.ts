import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const SOURCE = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

/** Service worker simulé : caches en mémoire, réseau qui renvoie `network`. */
function worker(network: (url: string) => Response, initialCaches: string[] = []) {
  const stores = new Map<string, Map<string, Response>>(initialCaches.map((n) => [n, new Map()]));
  const listeners: Record<string, (e: unknown) => void> = {};
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        put: async (req: Request, res: Response) => void store.set(req.url, res),
        addAll: async () => {},
      };
    },
    match: async (req: Request) => {
      for (const store of stores.values()) if (store.has(req.url)) return store.get(req.url);
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const self = {
    location: { origin: "https://ecole.test" },
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const fetchFn = async (req: Request) => network(req.url);
  new Function("self", "caches", "fetch", SOURCE)(self, caches, fetchFn);

  return {
    stores,
    async get(url: string) {
      let pending: Promise<Response> | undefined;
      listeners.fetch({ request: new Request(url), respondWith: (p: Promise<Response>) => (pending = p) });
      const res = await pending!;
      await new Promise((r) => setTimeout(r, 0));
      return res;
    },
    async activate() {
      let pending: Promise<unknown> | undefined;
      listeners.activate({ waitUntil: (p: Promise<unknown>) => (pending = p) });
      await pending;
    },
    cached: (url: string) => [...stores.values()].some((s) => s.has(url)),
  };
}

const CSS = "https://ecole.test/_next/static/css/abc123.css";
const basic = (body: string, type: string) => {
  const res = new Response(body, { status: 200, headers: { "content-type": type } });
  Object.defineProperty(res, "type", { value: "basic" });
  return res;
};

test("une page de l'opérateur reçue à la place du style n'est jamais gardée", async () => {
  let calls = 0;
  const sw = worker(() => {
    calls++;
    return calls === 1 ? basic("<html>Crédit épuisé</html>", "text/html") : basic("body{display:flex}", "text/css");
  });
  await sw.get(CSS);
  assert.equal(sw.cached(CSS), false, "la page HTML a été gardée comme fichier de style");
  const second = await sw.get(CSS);
  assert.equal(await second.text(), "body{display:flex}");
});

test("un vrai fichier de style est gardé (chargement rapide en 3G)", async () => {
  const sw = worker(() => basic("body{display:flex}", "text/css; charset=utf-8"));
  await sw.get(CSS);
  assert.equal(sw.cached(CSS), true);
});

test("la nouvelle version vide l'ancien cache, où un mauvais fichier a pu rester", async () => {
  const sw = worker(() => basic("", "text/css"), ["madrasati-shell-v3"]);
  await sw.activate();
  assert.equal(sw.stores.has("madrasati-shell-v3"), false);
});
