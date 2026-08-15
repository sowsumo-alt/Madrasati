// Service worker de Madrasati.
//
// Portée volontairement restreinte pour rester fiable :
// - Les fichiers statiques versionnés par Next.js (JS/CSS/icônes) sont mis en
//   cache : chargement quasi instantané dès la deuxième visite, précieux sur
//   une connexion 3G.
// - Les pages sont toujours servies depuis le réseau en priorité (données à
//   jour) ; une page de secours hors-ligne s'affiche seulement si le réseau
//   est injoignable — jamais de présence/note/paiement périmé affiché comme
//   s'il était à jour.
// - Toute requête qui n'est pas un GET (server actions Next.js, envoi de
//   formulaire) n'est JAMAIS interceptée : elle part directement au réseau,
//   exactement comme si ce service worker n'existait pas. Impossible donc de
//   dupliquer ou perdre un enregistrement d'appel, de note ou de paiement à
//   cause du cache.

const CACHE_NAME = "madrasati-shell-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
