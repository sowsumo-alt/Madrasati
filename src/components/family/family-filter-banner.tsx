"use client";

import Link from "next/link";
import { ArrowRight, Users, X } from "lucide-react";
import { familyLabel } from "@/lib/family";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

/**
 * Bandeau d'une liste filtrée sur une famille (Élèves, Paiements) : son nom,
 * le nombre d'enfants, l'accès à sa fiche et de quoi revenir à la liste
 * complète. `actions` accueille un bouton propre à la page.
 */
export function FamilyFilterBanner({
  parentId,
  parent,
  clearLabelKey,
  onClear,
  actions,
}: {
  parentId: string;
  parent: { lastName: string; familyName: string | null; familySize: number };
  clearLabelKey: TranslationKey;
  onClear: () => void;
  actions?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const name = familyLabel(parent, t("family.defaultName"));

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-center gap-2.5 text-sm font-semibold text-violet-900">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
          <Users className="h-4 w-4" />
        </span>
        {t("family.filterBanner").replace("{name}", name).replace("{count}", String(parent.familySize))}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <Link
          href={`/directeur/familles/${parentId}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-medium text-violet-800 ring-1 ring-violet-200 transition-colors hover:bg-violet-100"
        >
          {t("family.openFamily")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-violet-800 transition-colors hover:bg-violet-100"
        >
          <X className="h-4 w-4" />
          {t(clearLabelKey)}
        </button>
      </div>
    </div>
  );
}
