"use client";

import { Banknote, CalendarCheck, FileText } from "lucide-react";
import { FormSection } from "@/components/forms/form-section";
import { PaymentMethodPicker } from "@/components/payments/payment-method-picker";
import { formatMoney, fromMru, toMru, type AmountUnit } from "@/lib/money";
import { monthLabel } from "@/lib/tuition";
import { sheetLines, sheetTotals, todayIso, type SheetAlready } from "@/lib/family-sheet";
import { sheetDraftToInput, sheetMonths, type SheetDraft, type SheetMonthDraft } from "@/lib/family-sheet-draft";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { TuitionSettings } from "@/lib/tuition-data";
import { cn } from "@/lib/utils";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** « 2026-09-30 » → « 30/09/2026 ». */
export const shortDate = (iso: string) => iso.split("-").reverse().join("/");

/** Un enfant de la fiche : saisi à l'inscription, ou déjà enregistré. */
export interface SheetChild {
  key: string;
  firstName: string;
  lastName: string;
  classId: string;
  rimNumber?: string;
}

/**
 * Ce que la fiche a déjà reçu, pour une fiche déjà saisie (reprise de
 * l'existant) : relu en base par la page, contrôlé à nouveau par le serveur.
 */
export interface SheetExisting {
  already: SheetAlready;
  /** Par mois (ISO) : les dates des versements déjà enregistrés. */
  paidDates: Record<string, string[]>;
  /** Mois couverts par une échéance de plusieurs mois (trimestre…) : son libellé. */
  locked: Record<string, string>;
  /** Dates des versements de l'inscription déjà enregistrés. */
  enrollmentDates: string[];
}

/** La fiche (ou les fiches) en MRU, prêtes pour le récapitulatif et l'enregistrement. */
export function convertSheets(
  sheets: SheetDraft[],
  children: SheetChild[],
  unit: AmountUnit,
  yearMonths: string[],
  defaultFirstMonth: string | undefined,
  existing: (SheetExisting | null)[] = [],
) {
  return sheets.map((draft, index) => {
    const referentIndex = Math.max(
      0,
      children.findIndex((c) => c.key === draft.referentKey),
    );
    const months = sheetMonths(draft, yearMonths, defaultFirstMonth);
    return {
      draft,
      months,
      referent: children[referentIndex],
      ...sheetDraftToInput(draft, { unit, referentIndex, months, already: existing[index]?.already }),
    };
  });
}

/**
 * La fiche de paiement, copie de la fiche papier — dans l'ordre où la
 * secrétaire la recopie : élève référent, classe, N°, montant mensuel,
 * frais d'inscription, nombre d'élèves, puis Octobre → Juin avec, pour
 * chaque mois, la date, le montant versé et le solde.
 *
 * Le même écran pour une famille (une fiche familiale, ou une par enfant),
 * un élève seul, et une fiche reprise depuis la page d'une famille ou d'un
 * élève. Le récapitulatif est la simple addition des lignes : aucun montant
 * n'est multiplié par le nombre d'enfants.
 */
export function FamilySheetStep({
  entries,
  classes,
  settings,
  yearMonths,
  defaultFirstMonth,
  sheets,
  onSheetsChange,
  method,
  onMethodChange,
  existing = [],
  lockReferent = false,
  studentCount,
}: {
  entries: SheetChild[];
  classes: { id: string; name: string }[];
  settings: TuitionSettings;
  /** Mois de l'année scolaire, ISO. */
  yearMonths: string[];
  /** Premier mois facturé proposé (le mois de l'inscription, ou la rentrée). */
  defaultFirstMonth: string | undefined;
  sheets: SheetDraft[];
  onSheetsChange: (sheets: SheetDraft[]) => void;
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  /** Par fiche : ce qu'elle a déjà reçu (fiche déjà saisie). */
  existing?: (SheetExisting | null)[];
  /** La fiche est déjà rattachée à son élève référent : on ne le change plus ici. */
  lockReferent?: boolean;
  /** Nombre d'élèves inscrits de la famille (information seulement). */
  studentCount?: number;
}) {
  const unit = settings.amountUnit;
  const today = todayIso();
  const converted = convertSheets(sheets, entries, unit, yearMonths, defaultFirstMonth, existing);
  const lines = converted.flatMap((c) =>
    sheetLines(c.input).map((l) => ({ ...l, owner: sheets.length > 1 ? c.referent?.firstName ?? "" : "" })),
  );
  const totals = sheetTotals(lines);
  const perChild = sheets.length > 1;

  function patch(index: number, next: Partial<SheetDraft>) {
    onSheetsChange(sheets.map((s, i) => (i === index ? { ...s, ...next } : s)));
  }

  return (
    <div className="space-y-4" data-testid="family-sheet-step">
      {converted.map(({ draft, referent, input, errors, months }, index) => {
        const className = classes.find((c) => c.id === referent?.classId)?.name;
        const monthlyMru = input.monthly;
        const known = existing[index] ?? null;
        const setMonth = (month: string, value: SheetMonthDraft) =>
          patch(index, {
            months: { ...draft.months, [month]: value },
            ...(value.date ? { lastDate: value.date } : {}),
          });
        const lastMonth = yearMonths[yearMonths.length - 1];
        const enrollmentBefore = known?.already.enrollment?.paid ?? 0;
        const enrollmentLeft = input.enrollment.due - enrollmentBefore;
        // Mois encore ouverts : ni réglés, ni couverts par une échéance de plusieurs mois.
        const open = (m: string) => {
          const before = known?.already.months[m];
          return !known?.locked[m] && !(before && before.paid >= before.due);
        };
        return (
          <FormSection
            // Clé stable : changer de référent ne doit pas reconstruire la fiche
            // (la liste déroulante perdait le choix en cours).
            key={index}
            icon={FileText}
            title={
              perChild
                ? `Fiche de paiement — ${referent?.firstName ?? ""} ${referent?.lastName ?? ""}`
                : `Fiche de paiement${settings.yearLabel ? ` – Année scolaire ${settings.yearLabel}` : ""}${
                    entries.length > 1 ? " – Fiche familiale" : ""
                  }`
            }
            bodyClassName="block space-y-4 p-4"
          >
            {/* En-tête de la fiche, dans l'ordre de la fiche papier */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 text-sm sm:col-span-2">
                {!perChild && entries.length > 1 && !lockReferent ? (
                  <label className="block space-y-1.5">
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
                  </label>
                ) : (
                  <p>
                    <span className="font-medium text-foreground">{entries.length > 1 && !perChild ? "Élève référent : " : "Élève : "}</span>
                    {`${referent?.firstName ?? ""} ${referent?.lastName ?? ""}`.trim() || "—"}
                  </p>
                )}
                <p className="text-xs text-foreground/60">
                  Classe : {className ?? "—"} · N° : {referent?.rimNumber || "—"}
                </p>
              </div>
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
              <p className="text-xs text-foreground/60 sm:col-span-2">
                Nombre d&apos;élèves inscrits : <span className="font-semibold text-foreground">{perChild ? 1 : studentCount ?? entries.length}</span>
              </p>
            </div>

            {/* Tableau des mois */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground">Premier mois facturé</span>
                <select
                  value={months[0] ?? ""}
                  onChange={(e) => patch(index, { firstMonth: e.target.value })}
                  className="h-8 rounded-lg border border-border bg-surface px-2 text-sm"
                  data-testid="sheet-first-month"
                >
                  {yearMonths.map((m) => (
                    <option key={m} value={m}>
                      {capitalize(monthLabel(new Date(m)))}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-lg border border-border px-2.5 py-1 hover:bg-surface-muted"
                  onClick={() =>
                    patch(index, {
                      months: Object.fromEntries(
                        months
                          .filter(open)
                          .map((m) => [m, { checked: true, paid: draft.months[m]?.paid ?? "", date: draft.months[m]?.date ?? draft.lastDate }]),
                      ),
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
              <table className="w-full min-w-[34rem] text-sm" data-testid="sheet-months">
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
                    const before = known?.already.months[m];
                    const due = before?.due ?? monthlyMru;
                    const paidBefore = before?.paid ?? 0;
                    const lockedBy = known?.locked[m];
                    const settled = Boolean(before && paidBefore >= before.due);
                    const checked = row.checked && !settled && !lockedBy;
                    const paid = checked ? (row.paid.trim() === "" ? due - paidBefore : toMru(row.paid, unit).mru) : 0;
                    const balance = due - paidBefore - paid;
                    const dates = known?.paidDates[m] ?? [];
                    return (
                      <tr key={m} className="border-t border-border/70" data-testid="sheet-month-row" data-month={m.slice(0, 7)}>
                        <td className="px-3 py-1.5 font-medium">{capitalize(monthLabel(new Date(m)))}</td>
                        <td className="px-2 py-1.5 text-center">
                          {lockedBy || settled ? (
                            <span className="text-xs font-semibold text-emerald-700">✓</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setMonth(m, {
                                  checked: e.target.checked,
                                  paid: e.target.checked ? row.paid : "",
                                  date: e.target.checked ? row.date ?? draft.lastDate : undefined,
                                })
                              }
                              aria-label={`${monthLabel(new Date(m))} payé`}
                              className="h-4 w-4 rounded border-border text-primary-700"
                              data-testid={`sheet-month-${m.slice(0, 7)}`}
                            />
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-foreground/60">
                          {checked ? (
                            <input
                              type="date"
                              value={row.date || today}
                              max={today}
                              onChange={(e) => setMonth(m, { ...row, checked: true, date: e.target.value })}
                              className="h-8 rounded-md border border-border bg-surface px-2 text-sm"
                              aria-label={`Date de paiement de ${monthLabel(new Date(m))}`}
                              data-testid={`sheet-date-${m.slice(0, 7)}`}
                            />
                          ) : dates.length > 0 ? (
                            <span dir="ltr">{dates.map(shortDate).join(", ")}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-end">
                          {lockedBy ? (
                            <span className="text-xs text-foreground/55">Inclus dans « {lockedBy} »</span>
                          ) : checked ? (
                            <span className="inline-flex flex-col items-end gap-0.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                dir="ltr"
                                value={row.paid}
                                placeholder={draft.monthly || "0"}
                                onChange={(e) => setMonth(m, { ...row, checked: true, paid: e.target.value })}
                                className="h-8 w-28 rounded-md border border-border bg-surface px-2 text-end"
                                aria-label={`Montant versé pour ${monthLabel(new Date(m))}`}
                                data-testid={`sheet-paid-${m.slice(0, 7)}`}
                              />
                              {paidBefore > 0 && (
                                <span className="text-[11px] text-foreground/55">déjà versé {formatMoney(paidBefore, unit)}</span>
                              )}
                            </span>
                          ) : paidBefore > 0 ? (
                            <span dir="ltr">{formatMoney(paidBefore, unit)}</span>
                          ) : (
                            <span className="text-foreground/35">—</span>
                          )}
                        </td>
                        <td className={cn("px-3 py-1.5 text-end", (checked || settled) && balance <= 0 ? "text-emerald-700" : "text-foreground/60")}>
                          {lockedBy ? "—" : due <= 0 ? "—" : balance <= 0 && (checked || settled) ? "Payé" : formatMoney(Math.max(balance, 0), unit)}
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
                <span className="font-medium">
                  Frais d&apos;inscription
                  {enrollmentBefore > 0 && (
                    <span className="block text-xs font-normal text-foreground/60">
                      déjà versé {formatMoney(enrollmentBefore, unit)}
                      {known?.enrollmentDates.length ? ` le ${known.enrollmentDates.map(shortDate).join(", ")}` : ""}
                    </span>
                  )}
                </span>
                {enrollmentLeft > 0 ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={draft.enrollmentDate || today}
                      max={today}
                      onChange={(e) => patch(index, { enrollmentDate: e.target.value, lastDate: e.target.value })}
                      className="h-8 rounded-md border border-border bg-surface px-2 text-sm"
                      aria-label="Date de paiement de l'inscription"
                      data-testid="sheet-enrollment-date"
                    />
                    <label className="flex items-center gap-2">
                      <span className="text-xs text-foreground/60">Versé</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        value={draft.enrollmentPaid}
                        placeholder={fromMru(enrollmentLeft, unit)}
                        onChange={(e) => patch(index, { enrollmentPaid: e.target.value })}
                        className="h-8 w-28 rounded-md border border-border bg-surface px-2 text-end"
                        data-testid="sheet-enrollment-paid"
                      />
                      <span className="text-xs text-foreground/60">{unit}</span>
                    </label>
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-700">Payé</span>
                )}
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
          <p className="text-sm text-foreground/60">Aucun versement saisi.</p>
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

/** Le récapitulatif : une ligne par mois versé (avec sa date), l'inscription, puis le total. */
export function SheetRecap({
  lines,
  totals,
  unit,
}: {
  lines: { key: string; label: string; paid: number; owner?: string; kind: string; month: string | null; date?: string | null }[];
  totals: { paid: number; balance: number };
  unit: AmountUnit;
}) {
  const today = todayIso();
  const allToday = lines.every((l) => !l.date || l.date === today);
  return (
    <div className="text-sm" data-testid="sheet-recap" style={{ fontVariantNumeric: "tabular-nums" }}>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={`${l.owner}-${l.key}`} className="flex items-baseline justify-between gap-3">
            <span className="text-foreground/75">
              {l.label}
              {l.owner ? ` — ${l.owner}` : ""}
              {l.date && l.date !== today ? <span className="text-xs text-foreground/50"> · {shortDate(l.date)}</span> : null}
            </span>
            <span className="border-b border-dotted border-border/80 flex-1" aria-hidden />
            <span className="font-medium" dir="ltr">
              {formatMoney(l.paid, unit)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-primary-200 pt-2">
        <span className="font-semibold text-primary-900">{allToday ? "Total versé aujourd'hui" : "Total versé"}</span>
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
