"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatMRU } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-methods";
import { useSubmissionKeys } from "@/lib/submission-key";
import { cn } from "@/lib/utils";
import { correctSheetAction } from "./correct-actions";

/** Une ligne déjà encaissée de la fiche : un mois, l'inscription, ou un frais ajouté à la main. */
export interface CorrectionLine {
  feeId: string;
  /** Prénom et nom, quand la fiche compte plusieurs enfants. */
  student: string | null;
  label: string;
  due: number;
  paid: number;
  receipts: { number: string; date: string; amount: number }[];
}

const input = "h-9 w-28 rounded-md border bg-surface px-2 text-end";

/**
 * Corriger la fiche : le même tableau que celui de l'inscription, où l'on tape
 * ce qui a VRAIMENT été versé pour chaque ligne. À l'enregistrement, les reçus
 * touchés sont annulés (ils restent visibles, marqués « ANNULÉ ») et refaits
 * au bon montant ; un versement en plus donne un reçu de complément.
 */
export function SheetCorrection({
  lines,
  parentId,
  studentId,
  onClose,
}: {
  lines: CorrectionLine[];
  parentId: string | null;
  studentId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const submission = useSubmissionKeys();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.feeId, String(l.paid)])),
  );
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = lines.map((l) => {
    const raw = (values[l.feeId] ?? "").replace(/\s/g, "");
    const value = raw === "" ? 0 : Number(raw);
    const error = !Number.isInteger(value) || value < 0 ? "Montant invalide" : value > l.due ? `Au plus ${formatMRU(l.due)}` : null;
    return { line: l, value, error, changed: !error && value !== l.paid };
  });
  const changes = parsed.filter((p) => p.changed);
  const hasErrors = parsed.some((p) => p.error);
  const adds = changes.some((p) => p.value > p.line.paid);
  const canSave = changes.length > 0 && !hasErrors && reason.trim().length >= 3 && !saving;

  async function save() {
    setSaving(true);
    try {
      const result = await correctSheetAction({
        parentId,
        studentId,
        changes: changes.map((c) => ({ feeId: c.line.feeId, paid: c.value })),
        method,
        reason,
        submissionKey: submission.keyFor("correction"),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      submission.done("correction");
      toast.success(
        [
          "Fiche corrigée.",
          result.cancelled.length ? `Reçus annulés : ${result.cancelled.join(", ")}.` : "",
          result.issued.length ? `Nouveaux reçus : ${result.issued.join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
        { duration: 10_000 },
      );
      router.refresh();
      onClose();
    } catch {
      toast.error("La correction n'a pas abouti. Rien n'a été modifié : réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-amber-300 bg-surface p-4 shadow-soft sm:p-5" data-testid="sheet-correction">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <PenLine className="h-5 w-5 text-amber-600" />
          Corriger les montants déjà versés
        </h2>
        <p className="mt-1 text-sm text-foreground/65">
          Tapez, pour chaque ligne, ce qui a <b>vraiment</b> été versé. Rien n&apos;est effacé : les reçus touchés sont
          annulés (ils restent visibles, marqués « ANNULÉ ») et refaits au bon montant, au même jour.
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-foreground/60">
          Aucun paiement enregistré sur cette fiche : il n&apos;y a rien à corriger.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="bg-surface-muted/60 text-start text-xs font-semibold uppercase tracking-wide text-foreground/50">
                <th className="px-3 py-2 text-start">Ligne</th>
                <th className="px-2 py-2 text-end">Dû</th>
                <th className="px-2 py-2 text-end">Versé</th>
                <th className="px-3 py-2 text-start">Reçus</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map(({ line, error, changed }) => (
                <tr
                  key={line.feeId}
                  className={cn("border-t border-border/70 align-top", changed && "bg-amber-50")}
                  data-testid="correction-row"
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{line.label}</p>
                    {line.student && <p className="text-xs text-foreground/55">{line.student}</p>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-end" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMRU(line.due)}
                  </td>
                  <td className="px-2 py-2 text-end">
                    <input
                      value={values[line.feeId] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [line.feeId]: e.target.value }))}
                      inputMode="numeric"
                      dir="ltr"
                      aria-label={`Versé pour ${line.label}`}
                      className={cn(input, error ? "border-red-400" : changed ? "border-amber-500" : "border-border")}
                      data-testid="correction-paid"
                    />
                    {error ? (
                      <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>
                    ) : changed ? (
                      <p className="mt-1 text-[11px] text-amber-800">avant : {formatMRU(line.paid)}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-foreground/60">
                    {line.receipts.map((r) => (
                      <p key={r.number} className="whitespace-nowrap" dir="ltr">
                        {r.number} · {formatDate(r.date)} · {formatMRU(r.amount)}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {changes.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="correction-recap">
          <p className="font-semibold">À corriger :</p>
          <ul className="mt-1 list-disc ps-5">
            {changes.map((c) => (
              <li key={c.line.feeId}>
                {c.line.label}
                {c.line.student ? ` (${c.line.student})` : ""} : {formatMRU(c.line.paid)} → <b>{formatMRU(c.value)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Motif (obligatoire)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Ex. : un zéro de trop, le parent a versé 1 000"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3"
            data-testid="correction-reason"
          />
        </label>
        {adds && (
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Mode du complément</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Retour à la fiche
        </Button>
        <Button type="button" onClick={save} disabled={!canSave} data-testid="correction-save">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Enregistrer la correction
        </Button>
      </div>
    </section>
  );
}
