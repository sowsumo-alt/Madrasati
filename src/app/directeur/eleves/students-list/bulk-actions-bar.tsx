"use client";

import { ArrowRightLeft, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";

/** Bandeau des actions groupées, affiché dès qu'au moins un élève est coché. */
export function BulkActionsBar({
  count,
  onMove,
  onRemove,
  onClear,
}: {
  count: number;
  onMove: () => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-primary-100 bg-primary-50/70 px-4 py-2.5">
      <span className="me-auto text-sm font-semibold text-primary-900">
        {t("students.selectedCount").replace("{count}", String(count))}
      </span>
      <Button size="sm" variant="secondary" onClick={onMove}>
        <ArrowRightLeft className="h-4 w-4" />
        {t("students.bulkChangeClass")}
      </Button>
      <Button size="sm" variant="secondary" className="text-danger" onClick={onRemove}>
        <UserX className="h-4 w-4" />
        {t("students.bulkRemove")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="h-4 w-4" />
        {t("students.bulkClear")}
      </Button>
    </div>
  );
}
