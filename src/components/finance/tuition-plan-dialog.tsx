"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMRU } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  FREQUENCY_LABELS,
  TUITION_FREQUENCIES,
  buildInstallments,
  monthLabel,
  monthsBetween,
  periodMonthsOf,
  type TuitionFrequency,
} from "@/lib/tuition";
import type { TuitionFormData } from "@/lib/tuition-data";
import { saveTuitionPlan, tuitionForm } from "@/app/directeur/finance/tuition-actions";

/**
 * Formule de paiement des frais de scolarité d'un élève : mensuel,
 * trimestriel, N mois en une fois, ou l'année entière. Les échéances sont
 * montrées avant d'enregistrer ; les mois déjà réglés n'y figurent jamais.
 */
export function TuitionPlanDialog({
  studentId,
  students,
  onOpenChange,
}: {
  /** Élève concerné ; null : fermé. "" : le directeur choisit l'élève. */
  studentId: string | null;
  /** Élèves proposés quand aucun n'est choisi d'avance (page Finance). */
  students?: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const open = studentId !== null;
  const [chosen, setChosen] = useState<string>("");
  const [form, setForm] = useState<TuitionFormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frequency, setFrequency] = useState<TuitionFrequency>("MONTHLY");
  const [customMonths, setCustomMonths] = useState(4);
  const [monthly, setMonthly] = useState("");
  const [firstMonth, setFirstMonth] = useState("");

  const target = studentId || chosen;

  useEffect(() => {
    if (!open) {
      setChosen("");
      setForm(null);
      return;
    }
    if (!target) return;
    let cancelled = false;
    setLoading(true);
    tuitionForm(target)
      .then((data) => {
        if (cancelled || !data) return;
        setForm(data);
        setFrequency(data.plan?.frequency ?? "MONTHLY");
        setCustomMonths(data.plan?.frequency === "CUSTOM" ? data.plan.periodMonths : 4);
        setMonthly(String(data.plan?.monthlyAmount ?? data.schoolMonthly ?? ""));
        setFirstMonth(data.plan?.firstMonth ?? data.yearMonths[0] ?? "");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, target]);

  const amount = Number(monthly) || 0;
  const preview = useMemo(() => {
    if (!form || !firstMonth || form.yearMonths.length === 0) return null;
    const last = new Date(form.yearMonths[form.yearMonths.length - 1]);
    const billed = monthsBetween(new Date(firstMonth), last);
    const paid = new Set(form.paidMonths);
    const periodMonths = periodMonthsOf(frequency, customMonths, billed.length);
    const installments = buildInstallments({
      months: billed.filter((m) => !paid.has(m.toISOString())),
      periodMonths,
      monthlyAmount: amount,
      frequency,
      yearFirstMonth: new Date(form.yearMonths[0]),
      yearLabel: form.yearLabel,
    });
    return {
      installments,
      paidLabels: billed.filter((m) => paid.has(m.toISOString())).map(monthLabel),
      total: installments.reduce((sum, i) => sum + i.amount, 0),
    };
  }, [form, firstMonth, frequency, customMonths, amount]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const result = await saveTuitionPlan({
        studentId: form.student.id,
        frequency,
        customMonths,
        monthlyAmount: amount,
        firstMonth,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Formule enregistrée pour ${form.student.name} : ${result.created} échéance(s) créée(s).`,
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="tuition-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary-600" />
            Formule de paiement{form ? ` — ${form.student.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Comment le parent règle les frais de scolarité de l&apos;année. Les échéances sont
            créées automatiquement.
          </DialogDescription>
        </DialogHeader>

        {!studentId && (
          <div className="space-y-1.5">
            <Label>Élève</Label>
            <Select value={chosen} onValueChange={setChosen}>
              <SelectTrigger data-testid="tuition-student">
                <SelectValue placeholder="Choisir l'élève" />
              </SelectTrigger>
              <SelectContent>
                {(students ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading && (
          <p className="flex items-center gap-2 py-6 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        )}

        {form && !loading && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Formule</Label>
              <div className="flex flex-wrap gap-2">
                {TUITION_FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      frequency === f
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-border bg-surface text-foreground/75 hover:bg-primary-50/60",
                    )}
                    data-testid={`frequency-${f}`}
                  >
                    {FREQUENCY_LABELS[f]}
                  </button>
                ))}
              </div>
              {frequency === "CUSTOM" && (
                <div className="flex items-center gap-2 text-sm">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={customMonths}
                    onChange={(e) => setCustomMonths(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                    className="w-20"
                    data-testid="custom-months"
                  />
                  <span className="text-foreground/70">mois réglés en une fois</span>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tuition-monthly">Montant d&apos;un mois (MRU)</Label>
                <Input
                  id="tuition-monthly"
                  type="number"
                  min={1}
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                  data-testid="monthly-amount"
                />
                {form.schoolMonthly == null && (
                  <p className="text-xs text-foreground/50">
                    Astuce : renseignez le montant mensuel de l&apos;école dans les Paramètres, il sera
                    proposé ici.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>À partir de</Label>
                <Select value={firstMonth} onValueChange={setFirstMonth}>
                  <SelectTrigger data-testid="first-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {form.yearMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {monthLabel(new Date(m))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {preview && amount > 0 && (
              <div className="rounded-xl border border-border bg-surface-muted/40 p-3" data-testid="tuition-preview">
                <p className="text-sm font-semibold text-foreground">
                  {preview.installments.length} échéance(s) · total {formatMRU(preview.total)}
                </p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                  {preview.installments.map((i) => (
                    <li key={i.periodStart.toISOString()} className="flex justify-between gap-3">
                      <span className="text-foreground/75">{i.label.replace("Frais de scolarité — ", "")}</span>
                      <span className="whitespace-nowrap font-semibold text-foreground">{formatMRU(i.amount)}</span>
                    </li>
                  ))}
                </ul>
                {preview.paidLabels.length > 0 && (
                  <p className="mt-2 text-xs text-primary-700">
                    Déjà réglé, non refacturé : {preview.paidLabels.join(", ")}.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!form || saving || amount <= 0 || !firstMonth}
            data-testid="tuition-save"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer la formule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
