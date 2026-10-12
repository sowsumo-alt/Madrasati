"use client";

import { createContext, useContext } from "react";
import type { AppTheme } from "@/lib/app-theme";

/**
 * Thème de l'application des écoles, pour les composants qui dessinent leurs
 * couleurs eux-mêmes (graphiques en SVG) au lieu de suivre les jetons CSS.
 */
export const AppThemeContext = createContext<AppTheme>("light");

export function useAppTheme(): AppTheme {
  return useContext(AppThemeContext);
}
