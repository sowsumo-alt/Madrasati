"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";
import { refreshReportCardRule } from "../actions";

/**
 * Bandeau d'un bulletin déjà remis : il rappelle qu'il garde la règle de
 * calcul de ce jour-là, et permet de le repasser à la règle actuelle si le
 * directeur le souhaite. Jamais imprimé.
 */
export function RuleBanner({
  studentId,
  term,
  issuedAt,
}: {
  studentId: string;
  term: string;
  issuedAt: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    try {
      await refreshReportCardRule(studentId, term);
      toast.success(t("bulletin.ruleRefreshed"));
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
      <History className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1" data-testid="frozen-rule">
        {t("bulletin.frozenRule").replace("{date}", issuedAt)}
      </span>
      <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bulletin.useCurrentRule")}
      </Button>
    </div>
  );
}
