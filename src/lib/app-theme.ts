/**
 * Thème de l'application des écoles : clair (par défaut) ou sombre, au choix
 * de chacun (bouton soleil/lune de l'en-tête). Le choix est gardé dans un
 * cookie, sur l'appareil : le serveur le relit et la page arrive directement
 * dans le bon thème, sans clignotement. Couleurs : src/app/theme-dark.css.
 */
export type AppTheme = "light" | "dark";

export const APP_THEME_COOKIE = "madrasati-theme";

export function appThemeOf(value: string | undefined | null): AppTheme {
  return value === "dark" ? "dark" : "light";
}
