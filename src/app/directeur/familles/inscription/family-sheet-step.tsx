"use client";

import { Banknote, CalendarCheck, FileText } from "lucide-react";
import { FormSection } from "@/components/forms/form-section";
import { PaymentMethodPicker } from "@/components/payments/payment-method-picker";
import { formatDateIn } from "@/lib/format";
import { formatMoney, toMru, type AmountUnit } from "@/lib/money";
import { monthLabel } from "@/lib/tuition";
import { sheetLines, sheetTotals } from "@/lib/family-sheet";
import { sheetDraftToInput, type SheetDraft } from "@/lib/family-sheet-draft";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { TuitionSettings } from "@/lib/tuition-data";
import { cn } from "@/lib/utils";
import type { ChildDraft } from "./enrollment-draft";
import type { EnrollmentClassOption } from "./children-step";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** La fiche (ou les fiches) en MRU, prêtes pour le récapitulatif et l'enregistrement. */
export function convertSheets(sheets: SheetDraft[], children: ChildDraft[], unit: AmountUnit, months: string[]) {
  return sheets.map((draft) => {
    const referentIndex = Math.max(
      0,
      children.findIndex((c) => c.key === draft.referentKey),
    );
    return { draft, referent: children[referentIndex], ...sheetDraftToInput(draft, { unit, referentIndex, months }) };
  });
}

/**
 * Étape 3 d'une famille de plusieurs enfants : la fiche de paiement, copie de
 * la fiche papier — un montant mensuel et une inscription saisis tels quels,
 * le tableau des mois, et ce qui est versé aujourd'hui. Le récapitulatif est
 * la simple addition des lignes : aucun montant n'est multiplié par le
 * nombre d'enfants.
 */
export function FamilySheetStep({
  entries,
  classes,
  settings,
  months,
  sheets,
  onSheetsChange,
  method,
  onMethodChange,
}: {
  entries: ChildDraft[];
  classes: EnrollmentClassOption[];
  settings: TuitionSettings;
  /** Mois facturés, ISO : du mois de l'inscription à la fin de l'année. */
  months: string[];
  sheets: SheetDraft[];
  onSheetsChange: (sheets: SheetDraft[]) => void;
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
}) {
  const unit = settings.amountUnit;
  const converted = convertSheets(sheets, entries, unit, months);
  const lines = converted.flatMap((c) =>
    sheetLines(c.input).map((l) => ({ ...l, owner: sheets.length > 1 ? c.referent?.firstName ?? "" : "" })),
  );
  const totals = sheetTotals(lines);
  const perChild = sheets.length > 1;
  const today = formatDateIn("fr", new Date(), { day: "2-digit", month: "2-digit", year: "numeric" });

  function patch(index: number, next: Partial<SheetDraft>) {
    onSheetsChange(sheets.map((s, i) => (i === index ? { ...s, ...next } : s)));
  }

  return (
    <div className="space-y-4" data-testid="family-sheet-step">
      {converted.map(({ draft, referent, input, errors }, index) => {
        const className = classes.find((c) => c.id === referent?.classId)?.name;
        const monthlyMru = input.monthly;
        const setMonth = (month: string, value: { checked: boolean; paid: string }) =>
          patch(index, { months: { ...draft.months, [month]: value } });
        const lastMonth = months[months.length - 1];
        return (
          <FormSection
            // Clé stable : changer de référent ne doit pas reconstruire la fiche
            // (la liste déroulante perdait le choix en cours).
            key={index}
            icon={FileText}
            title={
              perChild
                ? `Fiche de paiement — ${referent?.firstName ?? ""} ${referent?.lastName ?? ""}`
                : `Fiche de paiement${settings.yearLabel ? ` – Année scolaire ${settings.yearLabel}` : ""} – Fiche familiale`
            }
            bodyClassName="block space-y-4 p-4"
          >
            {/* En-tête de la fiche */}
            <div className="grid gap-3 sm:grid-cols-2">
              {!perChild ? (
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-foreground">Élève référent</span>
                  <select
                    value={draft.referentKey}
                    onChange={(e) => patch(index, { referentKey: e.target.value })}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                    data-testid="sheet-referent"
                  >
                    {entries.map((c) => (
                      <option key={c.key} value={c.key}>
                        {`${c.firstName} ${c.lastName}`.trim() || "Enfant sans nom"}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs text-foreground/55">
                    {className ? `Classe ${className}` : ""}
                    {referent?.rimNumber ? ` · N° ${referent.rimNumber}` : ""}
                    {` · Nombre d'élèves inscrits : ${entries.length}`}
                  </span>
                </label>
              ) : (
                <p className="text-sm text-foreground/70">
                  {className ? `Classe ${className}` : ""}
                  {referent?.rimNumber ? ` · N° ${referent.rimNumber}` : ""}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <AmountField
                  id={`sheet-monthly-${index}`}
                  label="Montant mensuel"
                  unit={unit}
                  value={draft.monthly}
                  onChange={(monthly) => patch(index, { monthly })}
                  testId="sheet-monthly"
                />
                <AmountField
                  id={`sheet-enrollment-${index}`}
                  label="Frais d'inscription"
                  unit={unit}
                  value={draft.enrollmentDue}
                  onChange={(enrollmentDue) => patch(index, { enrollmentDue })}
                  testId="sheet-enrollment"
                />
              </div>
            </div>

            {/* Tableau des mois */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Mois payés aujourd&apos;hui</p>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-lg border border-border px-2.5 py-1 hover:bg-surface-muted"
                  onClick={() =>
                    patch(index, {
                      months: Object.fromEntries(months.map((m) => [m, { checked: true, paid: draft.months[m]?.paid ?? "" }])),
                    })
                  }
                  data-testid="sheet-check-all"
                >
                  Tout cocher
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border px-2.5 py-1 hover:bg-surface-muted"
                  onClick={() => patch(index, { months: {} })}
                  data-testid="sheet-check-none"
                >
                  Aucun
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[30rem] text-sm" data-testid="sheet-months">
                <thead className="bg-surface-muted/60 text-xs text-foreground/60">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold">Mois</th>
                    <th className="px-2 py-2 text-center font-semibold">Payé</th>
                    <th className="px-2 py-2 text-start font-semibold">Date de paiement</th>
                    <th className="px-2 py-2 text-end font-semibold">Montant versé</th>
                    <th className="px-3 py-2 text-end font-semibold">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => {
                    const row = draft.months[m] ?? { checked: false, paid: "" };
                    const paid = row.checked ? (row.paid.trim() === "" ? monthlyMru : toMru(row.paid, unit).mru) : 0;
                    const balance = monthlyMru - paid;
                    return (
                      <tr key={m} className="border-t border-border/70" data-testid="sheet-month-row" data-month={m.slice(0, 7)}>
                        <td className="px-3 py-1.5 font-medium">{capitalize(monthLabel(new Date(m)))}</td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) => setMonth(m, { checked: e.target.checked, paid: e.target.checked ? row.paid : "" })}
                            aria-label={`${monthLabel(new Date(m))} payé aujourd'hui`}
                            className="h-4 w-4 rounded border-border text-primary-700"
                            data-testid={`sheet-month-${m.slice(0, 7)}`}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-foreground/60">{row.checked ? today : "—"}</td>
                        <td className="px-2 py-1.5 text-end">
                          {row.checked ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              value={row.paid}
                              placeholder={draft.monthly || "0"}
                              onChange={(e) => setMonth(m, { checked: true, paid: e.target.value })}
                              className="h-8 w-28 rounded-md border border-border bg-surface px-2 text-end"
                              aria-label={`Montant versé pour ${monthLabel(new Date(m))}`}
                              data-testid={`sheet-paid-${m.slice(0, 7)}`}
                            />
                          ) : (
                            <span className="text-foreground/35">—</span>
                          )}
                        </td>
                        <td className={cn("px-3 py-1.5 text-end", row.checked && balance <= 0 ? "text-emerald-700" : "text-foreground/60")}>
                          {monthlyMru <= 0 ? "—" : row.checked && balance <= 0 ? "Payé" : formatMoney(Math.max(balance, 0), unit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {settings.prepayLastMonth && lastMonth && draft.months[lastMonth]?.checked && (
              <p className="text-xs font-medium text-amber-800" data-testid="sheet-nb">
                NB : le mois de {monthLabel(new Date(lastMonth)).split(" ")[0]} est payé en avance dès la date
                d&apos;inscription.
              </p>
            )}

            {/* Ligne d'inscription, séparée des mois */}
            {input.enrollment.due > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">Frais d&apos;inscription — {today}</span>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-foreground/60">Versé</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={draft.enrollmentPaid}
                    placeholder={draft.enrollmentDue}
                    onChange={(e) => patch(index, { enrollmentPaid: e.target.value })}
                    className="h-8 w-28 rounded-md border border-border bg-surface px-2 text-end"
                    data-testid="sheet-enrollment-paid"
                  />
                  <span className="text-xs text-foreground/60">{unit}</span>
                </label>
              </div>
            )}

            {errors.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" data-testid="sheet-errors">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </FormSection>
        );
      })}

      {/* Récapitulatif : la simple addition des lignes saisies */}
      <FormSection icon={CalendarCheck} title="Récapitulatif" bodyClassName="block p-4">
        {lines.length === 0 ? (
          <p className="text-sm text-foreground/60">Rien n&apos;est versé aujourd&apos;hui.</p>
        ) : (
          <SheetRecap lines={lines} totals={totals} unit={unit} />
        )}
      </FormSection>

      {totals.paid > 0 && (
        <FormSection icon={Banknote} title="Mode de paiement" bodyClassName="block p-4">
          <PaymentMethodPicker value={method} onChange={onMethodChange} />
        </FormSection>
      )}
    </div>
  );
}

/** Le récapitulatif : une ligne par mois versé, l'inscription, puis le total. */
export function SheetRecap({
  lines,
  totals,
  unit,
}: {
  lines: { key: string; label: string; paid: number; owner?: string; kind: string; month: string | null }[];
  totals: { paid: number; balance: number };
  unit: AmountUnit;
}) {
  return (
    <div className="text-sm" data-testid="sheet-recap" style={{ fontVariantNumeric: "tabular-nums" }}>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={`${l.owner}-${l.key}`} className="flex items-baseline justify-between gap-3">
            <span className="text-foreground/75">
              {l.label}
              {l.owner ? ` — ${l.owner}` : ""}
            </span>
            <span className="border-b border-dotted border-border/80 flex-1" aria-hidden />
            <span className="font-medium" dir="ltr">
              {formatMoney(l.paid, unit)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-primary-200 pt-2">
        <span className="font-semibold text-primary-900">Total versé aujourd&apos;hui</span>
        <span className="text-xl font-bold text-primary-800" dir="ltr" data-testid="sheet-total">
          {formatMoney(totals.paid, unit)}
        </span>
      </div>
      <div className="flex items-baseline justify-between text-foreground/70">
        <span>Reste dû sur ces lignes</span>
        <span dir="ltr" data-testid="sheet-balance">
          {formatMoney(totals.balance, unit)}
        </span>
      </div>
    </div>
  );
}

function AmountField({
  id,
  label,
  unit,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  unit: AmountUnit;
  value: string;
  onChange: (value: string) => void;
  testId: string;
}) {
  const { mru, error } = toMru(value, unit);
  return (
    <label htmlFor={id} className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <span className="relative block">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={cn(
            "h-10 w-full rounded-lg border bg-surface pe-12 ps-3 text-end font-semibold",
            error ? "border-red-400" : "border-border",
          )}
          data-testid={testId}
        />
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground/45">
          {unit}
        </span>
      </span>
      {unit === "MRO" && value.trim() && !error && (
        <span className="block text-xs text-foreground/55">= {formatMoney(mru, "MRU")}</span>
      )}
    </label>
  );
}
