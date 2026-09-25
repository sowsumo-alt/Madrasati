"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SECONDARY_OFFICIAL_SUBJECTS, SECONDARY_OFFICIAL_TOTAL } from "@/lib/grading";
import { useLanguage } from "@/lib/i18n/language-provider";
import { applyOfficialSecondaryCoefficients } from "./actions";

export interface SecondaryClassSummary {
  id: string;
  name: string;
  /** Somme actuelle des coefficients de la classe. */
  totalCoefficients: number;
}

/**
 * Coefficients du bulletin officiel de la 1°AS (total 24), appliqués d'un
 * geste aux classes que le directeur coche — pas à toutes : chaque niveau a
 * ses matières et ses coefficients. Le tableau reste affiché avant de
 * valider : le directeur voit exactement ce qui va changer.
 */
export function OfficialCoefficientsDialog({
  open,
  onOpenChange,
  classes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: SecondaryClassSummary[];
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Aucune classe cochée d'office : ce modèle est celui de la 1°AS, il ne
  // convient pas à toutes (une 7°C a d'autres matières et coefficients).
  const [selected, setSelected] = useState<string[]>([]);

  async function handleApply() {
    setLoading(true);
    try {
      const { classes: count } = await applyOfficialSecondaryCoefficients(selected);
      toast.success(t("classes.officialApplied").replace("{n}", String(count)));
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("classes.officialTitle")}</DialogTitle>
          <DialogDescription>{t("classes.officialHint")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <table className="w-full text-sm" data-testid="official-coefficients">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-primary-700">
                <th className="py-2 text-start">{t("classes.subject")}</th>
                <th className="py-2 text-end">{t("classes.coefficient")}</th>
              </tr>
            </thead>
            <tbody>
              {SECONDARY_OFFICIAL_SUBJECTS.map((s) => (
                <tr key={s.name} className="border-b border-border/60">
                  <td className="py-1.5">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="ms-2 text-foreground/50" dir="rtl" lang="ar">
                      {s.nameAr}
                    </span>
                  </td>
                  <td className="py-1.5 text-end font-semibold tabular-nums">{s.coefficient}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-bold text-primary-900">{t("classes.totalCoefficients")}</td>
                <td className="py-2 text-end font-bold tabular-nums text-primary-900">
                  {SECONDARY_OFFICIAL_TOTAL}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="rounded-xl bg-primary-50/60 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{t("classes.officialPick")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {classes.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setSelected((list) => (on ? list.filter((id) => id !== c.id) : [...list, c.id]))
                      }
                      className="h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
                      data-testid={`official-class-${c.name}`}
                    />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-foreground/50">
                      {t("classes.totalShort")} {c.totalCoefficients}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-foreground/55">{t("classes.officialNote")}</p>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleApply} disabled={loading || selected.length === 0} data-testid="apply-official">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("classes.officialApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
