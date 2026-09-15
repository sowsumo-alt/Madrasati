"use client";

import { Download, Loader2, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";

/** Bandeau des actions groupées, affiché dès qu'au moins un frais est coché. */
export function PaymentsBulkBar({
  count,
  exporting,
  onRemind,
  onExport,
  onClear,
}: {
  count: number;
  exporting: boolean;
  onRemind: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-primary-200 bg-primary-50/70 px-4 py-2.5">
      <span className="me-auto text-sm font-semibold text-primary-900">
        {t("finance.selectedCount").replace("{count}", String(count))}
      </span>
      <Button size="sm" variant="secondary" onClick={onRemind}>
        <MessageCircle className="h-4 w-4 text-emerald-600" />
        {t("finance.remindParents")}
      </Button>
      <Button size="sm" variant="secondary" onClick={onExport} disabled={exporting}>
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {t("finance.exportSelection")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="h-4 w-4" />
        {t("finance.clearSelection")}
      </Button>
    </div>
  );
}
