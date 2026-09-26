import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/super-admin-session";
import { loadOfficialHeader } from "@/lib/official-header-data";
import { formatDate } from "@/lib/format";
import { OfficialHeaderForm } from "./official-header-form";

export default async function OfficialHeaderPage() {
  await requireSuperAdmin();
  const header = await loadOfficialHeader();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/super-admin"
        className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Écoles clientes
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-white">Bloc officiel des bulletins</h1>
        <p className="mt-1 text-sm text-white/55">
          Imprimé en haut de chaque bulletin, identique pour toutes les écoles. Les directeurs ne
          peuvent pas le modifier. À changer uniquement si le Ministère change son intitulé.
        </p>
        <p className="mt-2 text-xs text-white/40">
          {header.isDefault
            ? "Texte livré avec Madrasati."
            : `Modifié le ${formatDate(header.updatedAt!)}.`}
        </p>
      </div>

      <OfficialHeaderForm
        initial={{ linesFr: header.linesFr, linesAr: header.linesAr }}
        isDefault={header.isDefault}
      />
    </div>
  );
}
