"use client";

import { useEffect } from "react";
import { startInstallPromptCapture } from "@/lib/install-prompt";

/**
 * Enregistre le service worker (public/sw.js) : cache les fichiers statiques
 * pour un chargement quasi instantané sur les visites suivantes (utile sur
 * une connexion 3G), et affiche une page de secours si le réseau est
 * injoignable. Ne met jamais en cache les requêtes de données (GET dynamique
 * ou POST) — voir les commentaires de sw.js.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Dès le chargement : Chrome et Edge n'offrent l'installation qu'une fois par page.
    startInstallPromptCapture();
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencieux : l'appli reste pleinement utilisable sans service worker
      // (navigateurs anciens, contexte non sécurisé, etc.).
    });
  }, []);

  return null;
}
