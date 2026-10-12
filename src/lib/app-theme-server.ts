import { cookies } from "next/headers";
import { APP_THEME_COOKIE, appThemeOf, type AppTheme } from "@/lib/app-theme";

/** Thème choisi sur cet appareil (clair si aucun choix). */
export async function getAppTheme(): Promise<AppTheme> {
  return appThemeOf((await cookies()).get(APP_THEME_COOKIE)?.value);
}
