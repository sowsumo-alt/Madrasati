"use client";

import { useState } from "react";

/**
 * Vrai dès qu'une fenêtre a été ouverte une fois, puis le reste. Sert à ne
 * télécharger le code d'une fenêtre (chargée à la demande) qu'au premier
 * clic, tout en la gardant montée ensuite pour son animation de fermeture.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}
