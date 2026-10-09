"use client";

import { useRef } from "react";

/**
 * Clés d'envoi des formulaires d'encaissement (voir runWithReceipt) : pour un
 * même sujet (un frais, un élève, une famille…), la clé reste la même tant
 * que l'envoi n'a pas abouti — un double clic ou un renvoi après une coupure
 * réseau rejoue alors le même envoi, que le serveur ne traite qu'une fois —
 * puis une nouvelle clé est tirée pour l'encaissement suivant.
 */
export function useSubmissionKeys() {
  const keys = useRef(new Map<string, string>());
  return {
    keyFor(subject = ""): string {
      let key = keys.current.get(subject);
      if (!key) {
        key = newSubmissionKey();
        keys.current.set(subject, key);
      }
      return key;
    },
    /** Envoi abouti : le prochain encaissement de ce sujet aura sa propre clé. */
    done(subject = ""): void {
      keys.current.delete(subject);
    },
  };
}

export function newSubmissionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
