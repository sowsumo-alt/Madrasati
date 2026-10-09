"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FamilySheetStep,
  FicheAmountsSummary,
  SheetRecap,
  convertFiche,
  type SheetChild,
  type SheetExisting,
} from "@/app/directeur/familles/inscription/family-sheet-step";
import type { FicheDraft } from "@/lib/family-fiche";
import { formatMoney } from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { TuitionSettings } from "@/lib/tuition-data";
import { clearDraft, loadDraft, useDraftAutosave } from "@/lib/form-draft";
import { DraftBanner } from "@/components/forms/draft-banner";
import { saveSheetAction } from "./actions";
import { useSubmissionKeys } from "@/lib/submission-key";

interface SheetEditorDraft {
  fiche: FicheDraft;
  method: PaymentMethod;
}

/**
 * La fiche de paiement d'élèves déjà inscrits, recopiée depuis la fiche
 * papier : le même formulaire que l'inscription, chaque mois avec sa date.
 * Gardée en brouillon jusqu'à l'enregistrement (coupure de courant).
 */
export function SheetEditor({
  title,
  backHref,
  parentId,
  entries,
  classes,
  settings,
  studentCount,
  initialDraft,
  familyExisting,
  childExisting,
  modeLock,
  draftKey,
}: {
  title: string;
  backHref: string;
  parentId: string | null;
  entries: SheetChild[];
  classes: { id: string; name: string }[];
  settings: TuitionSettings;
  studentCount: number;
  initialDraft: FicheDraft;
  /** Ce que la fiche familiale (forfait) a déjà reçu ; elle suit l'élève référent choisi. */
  familyExisting: SheetExisting | null;
  /** Ce que chaque enfant a déjà reçu sur sa propre fiche (montant par enfant). */
  childExisting: Record<string, SheetExisting>;
  modeLock: string | null;
  draftKey: string;
}) {
  const router = useRouter();
  const submission = useSubmissionKeys();
  const [fiche, setFiche] = useState<FicheDraft>(initialDraft);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // — Brouillon : la saisie revient après une page fermée ou une coupure.
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  useEffect(() => {
    const saved = loadDraft<SheetEditorDraft>(draftKey);
    if (saved?.data.fiche && Object.keys(saved.data.fiche.amounts).length === entries.length) {
      setFiche(saved.data.fiche);
      setMethod(saved.data.method);
      setDraftSavedAt(saved.savedAt);
    }
    setDraftReady(true);
    // Relu une seule fois, à l'ouverture de la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  const isEmpty = useCallback(
    (d: SheetEditorDraft) => JSON.stringify(d.fiche) === JSON.stringify(initialDraft),
    [initialDraft],
  );
  const autosave = useDraftAutosave<SheetEditorDraft>(draftKey, { fiche, method }, { enabled: draftReady, isEmpty });

  // Ce qui est déjà reçu : en forfait, la fiche de la famille, portée par le
  // référent choisi ; par enfant, la fiche de chacun.
  const existing: Record<string, SheetExisting> =
    fiche.mode === "FAMILY" && entries.length > 1
      ? familyExisting
        ? { [fiche.referentKey]: familyExisting }
        : {}
      : entries.length === 1
        ? (childExisting[entries[0].key] ?? familyExisting)
          ? { [entries[0].key]: (childExisting[entries[0].key] ?? familyExisting)! }
          : {}
        : childExisting;
  const converted = convertFiche(fiche, entries, settings.amountUnit, settings.yearMonths, settings.yearMonths[0], existing);
  const errors = converted.errors;
  const lines = converted.lines;
  const totals = converted.totals;

  async function save() {
    setSaving(true);
    try {
      const result = await saveSheetAction({
        parentId: parentId ?? undefined,
        method,
        mode: fiche.mode,
        referentStudentId: fiche.referentKey,
        sheets: converted.sheets.map((s) => ({ studentId: s.key, sheet: s.input })),
        submissionKey: submission.keyFor(),
      });
      if (!result.ok) {
        toast.error(result.error);
        setConfirmOpen(false);
        return;
      }
      submission.done();
      autosave.finish();
      const receipts = result.receipts;
      toast.success(
        receipts.length > 1 ? `Fiche enregistrée : ${receipts.length} reçus, un par date de paiement.` : "Fiche enregistrée.",
      );
      const only = receipts.length === 1 ? receipts[0] : null;
      router.push(
        only?.groupId
          ? `/directeur/finance/recus/famille/${only.groupId}`
          : only?.firstPaymentId
            ? `/directeur/finance/recus/${only.firstPaymentId}`
            : backHref,
      );
      router.refresh();
    } catch {
      toast.error("L'enregistrement n'a pas abouti. Rien n'a été enregistré : vérifiez la connexion et réessayez.");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-testid="sheet-editor">
      {draftSavedAt && (
        <DraftBanner
          savedAt={draftSavedAt}
          onDiscard={() => {
            clearDraft(draftKey);
            setDraftSavedAt(null);
            setFiche(initialDraft);
            setMethod("CASH");
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <FileText className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Fiche de paiement</h1>
            <p className="text-sm text-foreground/60">{title}</p>
          </div>
        </div>
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-foreground/55 hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          Retour
        </Link>
      </div>

      <FamilySheetStep
        entries={entries}
        classes={classes}
        settings={settings}
        yearMonths={settings.yearMonths}
        defaultFirstMonth={settings.yearMonths[0]}
        draft={fiche}
        onDraftChange={setFiche}
        method={method}
        onMethodChange={setMethod}
        existing={existing}
        modeLock={modeLock}
        studentCount={studentCount}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => (totals.paid > 0 ? setConfirmOpen(true) : save())}
          disabled={saving || errors.length > 0}
          className="w-full sm:w-auto sm:min-w-56"
          data-testid="sheet-review"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {totals.paid > 0
            ? `Vérifier et encaisser ${formatMoney(totals.paid, settings.amountUnit)}`
            : "Enregistrer la fiche"}
        </Button>
      </div>

      {/* Confirmation : le récapitulatif, puis l'encaissement — « Annuler » n'enregistre rien. */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !saving && setConfirmOpen(open)}>
        <DialogContent className="max-w-lg" data-testid="sheet-confirm">
          <DialogHeader>
            <DialogTitle>Confirmer la fiche de paiement</DialogTitle>
            <DialogDescription>
              {title} · {studentCount} élève(s) inscrit(s)
            </DialogDescription>
          </DialogHeader>
          {entries.length > 1 && <FicheAmountsSummary draft={fiche} entries={entries} unit={settings.amountUnit} />}
          <SheetRecap lines={lines} totals={totals} unit={settings.amountUnit} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={saving} data-testid="sheet-cancel">
              Annuler
            </Button>
            <Button type="button" onClick={save} disabled={saving} data-testid="sheet-confirm-button">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmer l&apos;encaissement de {formatMoney(totals.paid, settings.amountUnit)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
