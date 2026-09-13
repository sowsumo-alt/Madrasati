"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";
import { isChunkLoadError, reloadOnceAfterChunkError } from "@/lib/chunk-error";

/**
 * Écran affiché quand une page plante dans le navigateur, à la place de
 * l'écran blanc « Application error » de Next.js.
 *
 * Une erreur de chargement de fichier (page ouverte avant une mise en ligne)
 * se règle d'elle-même : la page est rechargée une fois, automatiquement.
 * Pour toute autre erreur, le bouton propose de recharger — un geste que le
 * directeur connaît, plutôt qu'un « réessayer » qui rejouerait la même erreur.
 */
export default function AppError({ error }: { error: Error & { digest?: string } }) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
    if (isChunkLoadError(error)) reloadOnceAfterChunkError();
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold text-foreground">{t("error.title")}</h1>
      <p className="max-w-md text-sm text-foreground/60">{t("error.hint")}</p>
      <Button className="mt-2" onClick={() => window.location.reload()}>
        <RefreshCw className="h-4 w-4" />
        {t("error.reload")}
      </Button>
    </div>
  );
}
