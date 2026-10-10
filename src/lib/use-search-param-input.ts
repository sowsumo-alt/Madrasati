"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Champ de recherche d'une liste paginée côté serveur : la saisie reste
 * fluide (état local) et n'est envoyée à l'adresse qu'après une courte pause.
 * Si l'adresse change ailleurs (menu, retour arrière), le champ la suit.
 */
export function useSearchParamInput(value: string, commit: (next: string) => void, delay = 350) {
  const [text, setText] = useState(value);
  const pushed = useRef(value);

  useEffect(() => {
    if (value !== pushed.current) {
      pushed.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === pushed.current) return;
    const timer = setTimeout(() => {
      pushed.current = text;
      commit(text);
    }, delay);
    return () => clearTimeout(timer);
    // Seule la saisie déclenche l'envoi ; commit est relu à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return [text, setText] as const;
}
