import Link from "next/link";
import { Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n/server";

/**
 * Lien périmé ou mal tapé : un message dans la langue du directeur et un
 * bouton pour repartir, au lieu du « 404 — This page could not be found ».
 * « / » renvoie chacun vers son espace (ou vers la connexion).
 */
export default async function NotFound() {
  const { t } = await getTranslations();
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-4xl font-bold text-primary-700">404</p>
      <h1 className="text-lg font-semibold text-foreground">{t("notFound.title")}</h1>
      <p className="max-w-md text-sm text-foreground/60">{t("notFound.hint")}</p>
      <Link href="/" className={buttonVariants({ className: "mt-2" })}>
        <Home className="h-4 w-4" />
        {t("notFound.back")}
      </Link>
    </div>
  );
}
