"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileDown, Loader2, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MonthSelect } from "@/components/timesheet/month-select";
import { formatMRU } from "@/lib/format";
import { LATE_DEDUCTION_LABELS, dmy, hoursLabel, monthLabelOf, type LateDeduction } from "@/lib/timesheet";
import type { PayLine } from "@/lib/timesheet-data";
import { PayParts, PayRates } from "@/components/timesheet/pay-rates";
import { addPayAdjustment, deletePayAdjustment, setHourlyRate, setSubjectRate, unlockMonth, validateMonth } from "../actions";

interface SubjectRate {
  id: string;
  name: string;
  hourlyRate: number | null;
}

interface Adjustment {
  id: string;
  teacherId: string;
  kind: string;
  amount: number;
  reason: string;
  createdByName: string;
  createdAt: string;
}

/** Une action serveur, avec message d'erreur clair et rafraîchissement de la page. */
function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "L'opération n'a pas abouti.");
        return false;
      }
      toast.success(success);
      router.refresh();
      return true;
    } catch {
      toast.error("L'opération n'a pas abouti. Vérifiez la connexion et réessayez.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

export function PayrollView({
  month,
  months,
  lines,
  totals,
  adjustments,
  teachers,
  subjects,
  locked,
  lateDeduction,
  readOnly,
}: {
  month: string;
  months: string[];
  lines: PayLine[];
  totals: { minutes: number; honoraires: number; deductions: number; net: number };
  adjustments: Adjustment[];
  teachers: { id: string; name: string; hourlyRate: number | null }[];
  subjects: SubjectRate[];
  locked: { at: string; by: string | null } | null;
  lateDeduction: LateDeduction;
  readOnly: boolean;
}) {
  const { busy, run } = useRun();
  const [adjustFor, setAdjustFor] = useState<{ id: string; name: string } | null>(null);
  const [confirmValidate, setConfirmValidate] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const editable = !readOnly && !locked;
  // Heures payées sans aucun prix (ni matière ni enseignant) : la matière et l'enseignant concernés.
  const unpriced = lines.flatMap((l) => (l.parts ?? []).filter((p) => p.rate == null && p.minutes > 0).map((p) => `${p.subject || "?"} (${l.name})`));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <MonthSelect months={months} value={month} />
        <div className="ms-auto flex flex-wrap gap-2">
          <Link href={`/directeur/pointage/fiches?mois=${month}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted" data-testid="all-sheets">
            <FileDown className="h-4 w-4" />
            Toutes les fiches du mois
          </Link>
          <Link href={`/directeur/pointage/fiches?mois=${month}&recap=1`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted" data-testid="recap-link">
            <FileDown className="h-4 w-4" />
            Récapitulatif
          </Link>
        </div>
      </div>

      {locked ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" data-testid="payroll-locked">
          <Lock className="h-4 w-4" />
          <span>
            Paie de {monthLabelOf(month)} validée le {dmy(new Date(locked.at))}
            {locked.by ? ` par ${locked.by}` : ""} : les montants sont figés.
          </span>
          {!readOnly && (
            <Button variant="secondary" size="sm" className="ms-auto" onClick={() => setUnlocking(true)} data-testid="payroll-unlock">
              <LockOpen className="h-3.5 w-3.5" />
              Déverrouiller
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground/70">
          <span>
            {LATE_DEDUCTION_LABELS[lateDeduction]} (
            <Link href="/directeur/parametres#pointage" className="underline">
              Paramètres
            </Link>
            ). Les montants suivent le pointage en direct jusqu&apos;à la validation.
          </span>
          {!readOnly && lines.length > 0 && (
            <Button className="ms-auto" onClick={() => setConfirmValidate(true)} data-testid="payroll-validate">
              <Lock className="h-4 w-4" />
              Valider la paie du mois
            </Button>
          )}
        </div>
      )}

      {!locked && unpriced.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="unpriced">
          Prix de l&apos;heure à renseigner pour : {unpriced.join(", ")}. Ces heures comptent 0 MRU pour l&apos;instant.{" "}
          {editable && (
            <a href="#prix-matieres" className="font-medium underline">
              Saisir les prix
            </a>
          )}
        </p>
      )}

      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/60">
          Aucune séance pointée ni déduction ce mois-ci.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[860px] text-sm" data-testid="payroll-table">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-foreground/60">
              <tr>
                <th className="px-3 py-2.5 text-start">Enseignant</th>
                <th className="px-3 py-2.5 text-end">Heures</th>
                <th className="px-3 py-2.5 text-end">Taux horaire</th>
                <th className="px-3 py-2.5 text-end">Honoraires</th>
                <th className="px-3 py-2.5 text-end">Retards</th>
                <th className="px-3 py-2.5 text-end">Avances</th>
                <th className="px-3 py-2.5 text-end">Autres</th>
                <th className="px-3 py-2.5 text-end">Net à payer</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l) => (
                <tr key={l.teacherId} data-testid="payroll-line" data-teacher={l.name}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{l.name}</p>
                    <p className="text-xs text-foreground/60">
                      {l.subjects.join(", ")}
                      {l.counts.ABSENT > 0 && ` · ${l.counts.ABSENT} absence(s)`}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">
                    {hoursLabel(l.minutes)}
                    {l.replacementMinutes > 0 && <span className="block text-xs text-foreground/60">dont {hoursLabel(l.replacementMinutes)} de remplacement</span>}
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums" data-testid="line-rate">
                    <PayRates pay={l} />
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">
                    <span data-testid="line-honoraires">{formatMRU(l.honoraires)}</span>
                    <PayParts pay={l} className="text-xs font-normal text-foreground/60 [&>li]:whitespace-nowrap" />
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">
                    {l.lateDeduction > 0 ? `−${formatMRU(l.lateDeduction)}` : "—"}
                    {l.lateMinutes > 0 && <span className="block text-xs text-foreground/60">{l.lateMinutes} min</span>}
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{l.advances > 0 ? `−${formatMRU(l.advances)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{l.otherDeductions > 0 ? `−${formatMRU(l.otherDeductions)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-end font-semibold tabular-nums text-foreground" data-testid="line-net">
                    <span className={l.net < 0 ? "text-red-700" : undefined}>{formatMRU(l.net)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-end">
                    {editable && (
                      <Button variant="secondary" size="sm" onClick={() => setAdjustFor({ id: l.teacherId, name: l.name })} data-testid="add-adjustment">
                        <Plus className="h-3.5 w-3.5" />
                        Déduction
                      </Button>
                    )}{" "}
                    <Link href={`/directeur/pointage/fiches?mois=${month}&enseignant=${l.teacherId}`} className="text-xs font-medium text-primary-700 underline">
                      Fiche
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border font-semibold">
              <tr>
                <td className="px-3 py-3">Masse salariale</td>
                <td className="px-3 py-3 text-end tabular-nums">{hoursLabel(totals.minutes)}</td>
                <td />
                <td className="px-3 py-3 text-end tabular-nums">{formatMRU(totals.honoraires)}</td>
                <td colSpan={3} className="px-3 py-3 text-end tabular-nums">
                  {totals.deductions > 0 ? `−${formatMRU(totals.deductions)}` : "—"}
                </td>
                <td className="px-3 py-3 text-end tabular-nums" data-testid="payroll-total-net">
                  {formatMRU(totals.net)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {adjustments.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Avances et déductions du mois</h2>
          <ul className="divide-y divide-border text-sm" data-testid="adjustments">
            {adjustments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <strong>{teachers.find((t) => t.id === a.teacherId)?.name ?? "?"}</strong> · {a.kind === "ADVANCE" ? "Avance" : "Déduction"} ·{" "}
                  {a.reason}
                  <span className="block text-xs text-foreground/50">
                    {dmy(new Date(a.createdAt))} par {a.createdByName}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">−{formatMRU(a.amount)}</span>
                {editable && (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-700"
                    aria-label="Retirer cette déduction"
                    disabled={busy}
                    onClick={() => run(() => deletePayAdjustment(a.id), "Déduction retirée.")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {editable && <SubjectRates subjects={subjects} />}
      {editable && <AllRates teachers={teachers} />}

      {adjustFor && <AdjustmentDialog teacher={adjustFor} month={month} onClose={() => setAdjustFor(null)} />}

      <Dialog open={confirmValidate} onOpenChange={setConfirmValidate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider la paie de {monthLabelOf(month)} ?</DialogTitle>
            <DialogDescription>
              Masse salariale : {formatMRU(totals.net)} pour {lines.length} enseignant(s). Les montants seront figés : plus aucune
              correction de séance ni déduction sur ce mois sans déverrouillage (tracé dans le journal). Chaque enseignant est prévenu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmValidate(false)}>
              Annuler
            </Button>
            <Button
              disabled={busy}
              onClick={async () => (await run(() => validateMonth(month), "Paie validée. Les enseignants sont prévenus.")) && setConfirmValidate(false)}
              data-testid="payroll-validate-confirm"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Valider et figer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {unlocking && <UnlockDialog month={month} onClose={() => setUnlocking(false)} />}
    </div>
  );
}

function RateInput({
  rate,
  onSave,
  label = "Taux horaire en MRU",
  testId = "rate-input",
}: {
  rate: number | null;
  onSave: (next: number | null) => Promise<{ ok: boolean; error?: string }>;
  label?: string;
  testId?: string;
}) {
  const { busy, run } = useRun();
  const [value, setValue] = useState(rate != null ? String(rate) : "");
  const save = () => {
    const next = value.trim() === "" ? null : Number(value);
    if (next === rate) return;
    if (next != null && (!Number.isInteger(next) || next < 0)) {
      toast.error("Saisissez un nombre entier de MRU (ex. : 1300).");
      return;
    }
    run(() => onSave(next), "Prix de l'heure enregistré.");
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className="h-8 w-24 rounded-lg border border-border bg-surface px-2 text-end tabular-nums"
        aria-label={label}
        data-testid={testId}
      />
      <span className="text-xs text-foreground/60">MRU/h</span>
    </span>
  );
}

/**
 * Prix de l'heure par matière (Physique 1 300 MRU/h, Maths 200 MRU/h…) : chaque
 * séance pointée est payée au prix de sa matière, automatiquement.
 */
function SubjectRates({ subjects }: { subjects: SubjectRate[] }) {
  const missing = subjects.filter((s) => s.hourlyRate == null).length;
  return (
    <section id="prix-matieres" className="scroll-mt-24 rounded-2xl border border-border bg-surface p-4 shadow-soft" data-testid="subject-rates">
      <h2 className="text-sm font-semibold text-foreground">Prix de l&apos;heure par matière</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Chaque cours pointé est payé au prix de sa matière, sans rien calculer à la main. Matière sans prix : le taux de
        l&apos;enseignant s&apos;applique.{missing > 0 && ` ${missing} matière(s) sans prix.`}
      </p>
      {subjects.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/60">Aucune matière : ajoutez-les d&apos;abord dans Matières.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm" data-subject={s.name}>
              <span className="truncate">{s.name}</span>
              <RateInput rate={s.hourlyRate} onSave={(next) => setSubjectRate(s.id, next)} label={`Prix de l'heure de ${s.name} en MRU`} testId="subject-rate-input" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Taux de chaque enseignant : seulement pour les matières qui n'ont pas de prix de l'heure. */
function AllRates({ teachers }: { teachers: { id: string; name: string; hourlyRate: number | null }[] }) {
  return (
    <details className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">Taux par enseignant (matières sans prix de l&apos;heure)</summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="all-rates">
        {teachers.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="truncate">{t.name}</span>
            <RateInput rate={t.hourlyRate} onSave={(next) => setHourlyRate(t.id, next)} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function AdjustmentDialog({ teacher, month, onClose }: { teacher: { id: string; name: string }; month: string; onClose: () => void }) {
  const { busy, run } = useRun();
  const [kind, setKind] = useState<"ADVANCE" | "OTHER">("ADVANCE");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="adjustment-dialog">
        <DialogHeader>
          <DialogTitle>Déduction sur la paie</DialogTitle>
          <DialogDescription>
            {teacher.name} · {monthLabelOf(month)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            {(
              [
                ["ADVANCE", "Avance"],
                ["OTHER", "Autre déduction"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <input type="radio" checked={kind === value} onChange={() => setKind(value)} />
                {label}
              </label>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="font-medium text-foreground/70">Montant (MRU)</span>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 w-40 rounded-lg border border-border bg-surface px-3" data-testid="adjustment-amount" />
          </label>
          <label className="block space-y-1">
            <span className="font-medium text-foreground/70">Motif</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="h-10 w-full rounded-lg border border-border bg-surface px-3" placeholder="Ex. : avance du 10/11" data-testid="adjustment-reason" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={busy}
            onClick={async () =>
              (await run(() => addPayAdjustment({ teacherId: teacher.id, month, kind, amount: Number(amount), reason }), "Déduction enregistrée.")) && onClose()
            }
            data-testid="adjustment-save"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({ month, onClose }: { month: string; onClose: () => void }) {
  const { busy, run } = useRun();
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Déverrouiller la paie de {monthLabelOf(month)}</DialogTitle>
          <DialogDescription>Les montants pourront de nouveau changer. Le motif est inscrit au journal d&apos;activité.</DialogDescription>
        </DialogHeader>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground/70">Motif</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="h-10 w-full rounded-lg border border-border bg-surface px-3" placeholder="Ex. : séance du 12/11 oubliée" data-testid="unlock-reason" />
        </label>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={busy} onClick={async () => (await run(() => unlockMonth(month, reason), "Paie déverrouillée.")) && onClose()} data-testid="unlock-confirm">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Déverrouiller
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
