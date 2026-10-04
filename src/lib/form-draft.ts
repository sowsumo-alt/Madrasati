"use client";

import { useEffect, useRef } from "react";

/**
 * Brouillons des formulaires d'inscription : la saisie en cours est gardée
 * dans le navigateur à chaque frappe. Une fenêtre fermée par un clic à côté,
 * une page rechargée, une coupure de courant : en revenant, on reprend là où
 * on s'était arrêté, jusqu'à ce que l'inscription soit enregistrée.
 *
 * Stockage local (localStorage) : il survit à l'arrêt de l'ordinateur, et ne
 * quitte jamais l'appareil. La clé porte l'école, pour qu'un directeur qui
 * change d'école sur le même navigateur ne retrouve pas le brouillon d'une
 * autre (avec des classes qui n'existent pas chez lui).
 */

const PREFIX = "madrasati:brouillon:";

export interface StoredDraft<T> {
  data: T;
  /** Date de la dernière sauvegarde, en millisecondes. */
  savedAt: number;
}

export function loadDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    return parsed && typeof parsed.savedAt === "number" && parsed.data ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, data: T) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Stockage plein ou bloqué (navigation privée) : le formulaire marche
    // quand même, sans brouillon.
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Rien à faire : sans stockage, il n'y avait pas de brouillon.
  }
}

/**
 * Sauvegarde `data` à chaque changement (regroupé sur 400 ms), et tout de
 * suite si la page se ferme. `isEmpty` : une saisie vide efface le brouillon
 * plutôt que d'en garder un sans rien dedans. `enabled` à false : rien n'est
 * sauvegardé (modification d'un élève existant, brouillon pas encore relu).
 *
 * Renvoie `finish` : à appeler une fois l'inscription enregistrée. Le
 * brouillon est effacé, et aucune sauvegarde encore en attente ne le recrée.
 */
export function useDraftAutosave<T>(
  key: string,
  data: T,
  { enabled, isEmpty }: { enabled: boolean; isEmpty: (data: T) => boolean },
) {
  const latest = useRef({ data, enabled, isEmpty });
  latest.current = { data, enabled, isEmpty };
  const finished = useRef(false);

  useEffect(() => {
    // Une nouvelle saisie commence (fenêtre rouverte) : la sauvegarde reprend.
    if (enabled) finished.current = false;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      if (finished.current) return;
      if (isEmpty(data)) clearDraft(key);
      else saveDraft(key, data);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [key, data, enabled, isEmpty]);

  useEffect(() => {
    function flush() {
      const { data: current, enabled: on, isEmpty: empty } = latest.current;
      if (!on || finished.current) return;
      if (empty(current)) clearDraft(key);
      else saveDraft(key, current);
    }
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [key]);

  return {
    finish() {
      finished.current = true;
      clearDraft(key);
    },
  };
}

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** « 4 octobre à 14:32 » : quand le brouillon a été gardé. */
export function draftTime(savedAt: number) {
  return timeFormatter.format(new Date(savedAt));
}
