"use client";

import { Users } from "lucide-react";
import { familyLabel } from "@/lib/family";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Pastille « Famille BA · 3 » sous le parent d'un élève ou d'un frais : un
 * clic filtre la liste sur toute la famille. Affichée à partir de deux
 * enfants — un enfant seul n'a pas de famille à regrouper.
 */
export function FamilyBadge({
  parent,
  onClick,
}: {
  parent: { lastName: string; familyName: string | null; familySize: number };
  onClick: () => void;
}) {
  const { t } = useLanguage();
  if (parent.familySize < 2) return null;
  const name = familyLabel(parent, t("family.defaultName"));

  return (
    <button
      type="button"
      onClick={onClick}
      title={t("family.badgeTitle")}
      className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200 transition-colors hover:bg-violet-100"
    >
      <Users className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {t("family.badge").replace("{name}", name).replace("{count}", String(parent.familySize))}
      </span>
    </button>
  );
}
