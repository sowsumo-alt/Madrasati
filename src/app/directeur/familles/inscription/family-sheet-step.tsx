"use client";

import { Fragment, useState } from "react";
import { Banknote, CalendarCheck, Check, FileText, UsersRound } from "lucide-react";
import { FormSection } from "@/components/forms/form-section";
import { PaymentMethodPicker } from "@/components/payments/payment-method-picker";
import { formatMoney, fromMru, toMru, type AmountUnit } from "@/lib/money";
import { monthLabel } from "@/lib/tuition";
import { sheetLines, sheetTotals, todayIso, type SheetAlready } from "@/lib/family-sheet";
import {
  FICHE_MODE_LABELS,
  childStatus,
  emptyAmounts,
  ficheMonths,
  ficheToSheets,
  payingKeys,
  type FicheAmounts,
  type FicheDraft,
  type FicheMode,
  type FicheMonth,
} from "@/lib/family-fiche";
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
 * Ce qu'un enfant a déjà reçu, pour une fiche déjà saisie (reprise de
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

/**
 * La fiche en MRU, prête pour le récapitulatif, la confirmation et
 * l'enregistrement : les mêmes lignes partout (lib/family-fiche.ts, puis
 * lib/family-sheet.ts pour le calcul).
 */
export function convertFiche(
  draft: FicheDraft,
  children: SheetChild[],
  unit: AmountUnit,
  yearMonths: string[],
  defaultFirstMonth: string | undefined,
  existing: Record<string, SheetExisting> = {},
) {
  const months = ficheMonths(draft, yearMonths, defaultFirstMonth);
  const already = Object.fromEntries(Object.entries(existing).map(([k, e]) => [k, e.already]));
  const conversion = ficheToSheets(draft, { unit, children, months, already });
  const named = conversion.sheets.length > 1;
  const nameOf = (key: string) => children.find((c) => c.key === key)?.firstName ?? "";
  const lines = conversion.sheets.flatMap((s) =>
    sheetLines(s.input).map((l) => ({ ...l, owner: named ? nameOf(s.key) : "" })),
  );
  return { months, ...conversion, lines, totals: sheetTotals(lines) };
}

/**
 * La fiche de paiement, copie de la fiche papier : tous les enfants de la
 * famille — une carte par enfant —, la façon de facturer (forfait famille ou
 * montant par enfant), puis Octobre → Juin avec, pour chaque mois, le dû,
 * la date, le montant versé et le solde.
 *
 * Le même écran pour une famille, un élève seul (une fiche à un enfant) et
 * une fiche reprise depuis la page d'une famille ou d'un élève. Les montants
 * sont saisis par le directeur, jamais copiés d'un enfant à l'autre ni
 * multipliés : le dû d'un mois est la somme des mensuels saisis.
 */
export function FamilySheetStep({
  entries,
  classes,
  settings,
  yearMonths,
  defaultFirstMonth,
  draft,
  onDraftChange,
  method,
  onMethodChange,
  existing = {},
  modeLock = null,
  studentCount,
}: {
  entries: SheetChild[];
  classes: { id: string; name: string }[];
  settings: TuitionSettings;
  /** Mois de l'année scolaire, ISO. */
  yearMonths: string[];
  /** Premier mois facturé proposé (le mois de l'inscription, ou la rentrée). */
  defaultFirstMonth: string | undefined;
  draft: FicheDraft;
  onDraftChange: (draft: FicheDraft) => void;
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  /** Par enfant : ce qu'il a déjà reçu (fiche déjà saisie). */
  existing?: Record<string, SheetExisting>;
  /** Pourquoi la façon de facturer ne peut plus changer (paiements déjà enregistrés). */
  modeLock?: string | null;
  /** Nombre d'élèves inscrits de la famille (information seulement). */
  studentCount?: number;
}) {
  const unit = settings.amountUnit;
  const today = todayIso();
  const multi = entries.length > 1;
  const fiche = convertFiche(draft, entries, unit, yearMonths, defaultFirstMonth, existing);
  const paying = payingKeys(draft, entries);
  const referent = entries.find((c) => c.key === draft.referentKey) ?? entries[0];
  const [selected, setSelected] = useState<string>(paying[0] ?? entries[0]?.key ?? "");
  // L'enfant dont on saisit les montants : celui choisi (par enfant), le référent (forfait).
  const editingKey = draft.mode === "PER_CHILD" && paying.includes(selected) ? selected : paying[0];
  const editing = entries.find((c) => c.key === editingKey);
  const className = (c: SheetChild | undefined) => classes.find((cl) => cl.id === c?.classId)?.name;
  const lastMonth = yearMonths[yearMonths.length - 1];

  function patch(next: Partial<FicheDraft>) {
    onDraftChange({ ...draft, ...next });
  }
  function patchAmounts(key: string, next: Partial<FicheAmounts>) {
    patch({ amounts: { ...draft.amounts, [key]: { ...(draft.amounts[key] ?? emptyAmounts()), ...next } } });
  }
  function setMonth(month: string, value: FicheMonth) {
    patch({ months: { ...draft.months, [month]: value }, ...(value.date ? { lastDate: value.date } : {}) });
  }
  function setMode(mode: FicheMode) {
    if (mode === draft.mode) return;
    // Les mois cochés gardent leur case, mais pas un montant tapé pour l'autre façon de facturer.
    const months = Object.fromEntries(
      Object.entries(draft.months).map(([m, row]) => [m, { checked: row.checked, paid: "", date: row.date }]),
    );
    patch({ mode, months });
  }
  function setReferent(key: string) {
    if (draft.mode === "FAMILY" && key !== draft.referentKey) {
      // En forfait, les montants sont ceux de la famille : ils suivent le référent.
      const amounts = { ...draft.amounts, [key]: draft.amounts[draft.referentKey] ?? emptyAmounts(), [draft.referentKey]: emptyAmounts() };
      patch({ referentKey: key, amounts });
    } else {
      patch({ referentKey: key });
    }
  }

  // Par mois : le dû de la famille et ce qu'elle a déjà versé (fiche reprise).
  const monthState = (m: string) => {
    let due = 0;
    let before = 0;
    let locked: string | null = null;
    const dates = new Set<string>();
    for (const key of paying) {
      const e = existing[key];
      const known = e?.already.months[m];
      due += known ? known.due : (fiche.monthly[key] ?? 0);
      before += known?.paid ?? 0;
      if (e?.locked[m]) locked = e.locked[m];
      for (const d of e?.paidDates[m] ?? []) dates.add(d);
    }
    return { due, before, locked, dates: [...dates].sort() };
  };
  const open = (m: string) => {
    const s = monthState(m);
    return !s.locked && !(s.due > 0 && s.before >= s.due);
  };

  return (
    <div className="space-y-4" data-testid="family-sheet-step">
      <FormSection
        icon={FileText}
        title={`Fiche de paiement${settings.yearLabel ? ` – Année scolaire ${settings.yearLabel}` : ""}${multi ? " – Fiche familiale" : ""}`}
        bodyClassName="block space-y-4 p-4"
      >
        {multi && (
          <fieldset className="space-y-2" disabled={Boolean(modeLock)}>
            <legend className="mb-1.5 text-sm font-medium text-foreground">Comment la famille est-elle facturée ?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["FAMILY", "PER_CHILD"] as const).map((mode) => (
                <label
                  key={mode}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm",
                    draft.mode === mode ? "border-primary-600 bg-primary-50" : "border-border",
                    modeLock && "cursor-not-allowed opacity-70",
                  )}
                >
                  <input
                    type="radio"
                    name="fiche-mode"
                    checked={draft.mode === mode}
                    onChange={() => setMode(mode)}
                    className="mt-0.5"
                    data-testid={`fiche-mode-${mode}`}
                  />
                  <span>
                    <span className="block font-semibold">{FICHE_MODE_LABELS[mode]}</span>
                    <span className="block text-xs text-foreground/60">
                      {mode === "FAMILY"
                        ? "Un mensuel et une inscription pour toute la famille, portés par l'élève référent."
                        : "Chaque enfant a son mensuel et son inscription ; le dû d'un mois est leur somme."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {modeLock && <p className="text-xs text-amber-800">{modeLock}</p>}
          </fieldset>
        )}

        {/* Les enfants : une carte chacun, avec où en est sa saisie. */}
        {multi ? (
          <div className="grid gap-2 sm:grid-cols-2" data-testid="fiche-children">
            {entries.map((child) => {
              const status = childStatus(draft, entries, child.key);
              const a = draft.amounts[child.key];
              const isEditing = child.key === editingKey && draft.mode === "PER_CHILD";
              return (
                <button
                  key={child.key}
                  type="button"
                  onClick={() => setSelected(child.key)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-start text-sm transition-colors",
                    isEditing ? "border-primary-600 bg-primary-50/60 ring-2 ring-primary-100" : "border-border hover:bg-surface-muted/60",
                  )}
                  data-testid="fiche-child"
                  data-key={child.key}
                  data-status={status}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-foreground">
                      {`${child.firstName} ${child.lastName}`.trim() || "Enfant sans nom"}
                    </span>
                    {child.key === referent?.key && (
                      <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-800">
                        Référent
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-foreground/55">
                    Classe {className(child) ?? "—"} · N° {child.rimNumber || "—"}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-xs font-medium",
                      status === "DONE" ? "text-emerald-700" : status === "TODO" ? "text-amber-700" : "text-foreground/55",
                    )}
                  >
                    {status === "INCLUDED"
                      ? "Inclus dans la fiche familiale"
                      : status === "DONE"
                        ? `✓ saisi · ${a?.monthly ? `${a.monthly} ${unit} / mois` : "pas de mensuel"}${a?.enrollmentDue ? ` · inscription ${a.enrollmentDue} ${unit}` : ""}`
                        : "à saisir"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm">
            <span className="font-medium text-foreground">Élève : </span>
            {`${referent?.firstName ?? ""} ${referent?.lastName ?? ""}`.trim() || "—"}
            <span className="block text-xs text-foreground/60">
              Classe : {className(referent) ?? "—"} · N° : {referent?.rimNumber || "—"}
            </span>
          </p>
        )}

        {/* Les montants de l'enfant choisi, ou ceux de la famille (forfait). */}
        {editingKey && (
          <div className="space-y-2 rounded-xl border border-border/80 bg-surface-muted/30 p-3" data-testid="fiche-amounts" data-key={editingKey}>
            {multi && (
              <p className="text-sm font-semibold text-foreground">
                {draft.mode === "FAMILY"
                  ? `Montants de la famille — portés par ${referent?.firstName ?? ""}`
                  : `Montants de ${editing?.firstName ?? ""}`}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <AmountField
                id={`sheet-monthly-${editingKey}`}
                label="Montant mensuel"
                unit={unit}
                value={draft.amounts[editingKey]?.monthly ?? ""}
                onChange={(monthly) => patchAmounts(editingKey, { monthly })}
                testId="sheet-monthly"
              />
              <AmountField
                id={`sheet-enrollment-${editingKey}`}
                label="Frais d'inscription"
                unit={unit}
                value={draft.amounts[editingKey]?.enrollmentDue ?? ""}
                onChange={(enrollmentDue) => patchAmounts(editingKey, { enrollmentDue })}
                testId="sheet-enrollment"
              />
            </div>
            {draft.mode === "PER_CHILD" && multi && (
              <div className="flex justify-end">
                {(() => {
                  const next = entries.find((c) => c.key !== editingKey && childStatus(draft, entries, c.key) === "TODO");
                  return next ? (
                    <button
                      type="button"
                      onClick={() => setSelected(next.key)}
                      className="inline-flex min-h-11 items-center text-xs font-semibold text-primary-700 hover:underline sm:min-h-0"
                      data-testid="fiche-next-child"
                    >
                      Enfant suivant : {next.firstName} →
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> Tous les enfants sont saisis
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {multi && (
            <label className="flex flex-wrap items-center gap-2">
              <span className="text-foreground/70">Élève référent (nom porté sur la fiche papier)</span>
              <select
                value={referent?.key ?? ""}
                onChange={(e) => setReferent(e.target.value)}
                className="h-8 rounded-lg border border-border bg-surface px-2 text-sm"
                data-testid="sheet-referent"
              >
                {entries.map((c) => (
                  <option key={c.key} value={c.key}>
                    {`${c.firstName} ${c.lastName}`.trim() || "Enfant sans nom"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="text-xs text-foreground/60">
            Nombre d&apos;élèves inscrits : <span className="font-semibold text-foreground">{studentCount ?? entries.length}</span>
          </span>
        </div>
      </FormSection>

      <FormSection icon={CalendarCheck} title="Mois" bodyClassName="block space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">Premier mois facturé</span>
            <select
              value={fiche.months[0] ?? ""}
              onChange={(e) => patch({ firstMonth: e.target.value })}
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
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 hover:bg-surface-muted sm:min-h-0 sm:px-2.5 sm:py-1"
              onClick={() =>
                patch({
                  months: Object.fromEntries(
                    fiche.months
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
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 hover:bg-surface-muted sm:min-h-0 sm:px-2.5 sm:py-1"
              onClick={() => patch({ months: {} })}
              data-testid="sheet-check-none"
            >
              Aucun
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[36rem] text-sm" data-testid="sheet-months">
            <thead className="bg-surface-muted/60 text-xs text-foreground/60">
              <tr>
                <th className="px-3 py-2 text-start font-semibold">Mois</th>
                <th className="px-2 py-2 text-center font-semibold">Payé</th>
                <th className="px-2 py-2 text-start font-semibold">Date de paiement</th>
                <th className="px-2 py-2 text-end font-semibold">Dû</th>
                <th className="px-2 py-2 text-end font-semibold">Montant versé</th>
                <th className="px-3 py-2 text-end font-semibold">Solde</th>
              </tr>
            </thead>
            <tbody>
              {fiche.months.map((m) => {
                const row = draft.months[m] ?? { checked: false, paid: "" };
                const state = monthState(m);
                const settled = state.due > 0 && state.before >= state.due;
                const checked = row.checked && !settled && !state.locked;
                const computed = fiche.rows[m];
                const paid = checked ? (computed?.paid ?? 0) : 0;
                const balance = state.due - state.before - paid;
                const left = Math.max(state.due - state.before, 0);
                // Répartition entre les enfants : montrée quand le mois n'est pas réglé en entier.
                const showSplit =
                  checked && paying.length > 1 && computed && (computed.customSplit || computed.paid < left);
                return (
                  <Fragment key={m}>
                    <tr className="border-t border-border/70" data-testid="sheet-month-row" data-month={m.slice(0, 7)}>
                      <td className="px-3 py-1.5 font-medium">{capitalize(monthLabel(new Date(m)))}</td>
                      <td className="px-2 py-1.5 text-center">
                        {state.locked || settled ? (
                          <span className="text-xs font-semibold text-emerald-700">✓</span>
                        ) : (
                          // Zone de 44 px autour de la case : sur téléphone, cocher
                          // le bon mois au doigt sans toucher le voisin.
                          <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setMonth(m, {
                                  checked: e.target.checked,
                                  paid: "",
                                  date: e.target.checked ? row.date ?? draft.lastDate : undefined,
                                })
                              }
                              aria-label={`${monthLabel(new Date(m))} payé`}
                              className="h-6 w-6 rounded border-border text-primary-700"
                              data-testid={`sheet-month-${m.slice(0, 7)}`}
                            />
                          </label>
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
                        ) : state.dates.length > 0 ? (
                          <span dir="ltr">{state.dates.map(shortDate).join(", ")}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-end text-foreground/70" dir="ltr">
                        {state.locked ? "—" : state.due > 0 ? formatMoney(state.due, unit) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-end">
                        {state.locked ? (
                          <span className="text-xs text-foreground/55">Inclus dans « {state.locked} »</span>
                        ) : checked ? (
                          computed?.customSplit ? (
                            <span className="font-medium" dir="ltr">
                              {formatMoney(paid, unit)}
                            </span>
                          ) : (
                            <span className="inline-flex flex-col items-end gap-0.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                dir="ltr"
                                value={row.paid}
                                placeholder={fromMru(left, unit)}
                                onChange={(e) => setMonth(m, { ...row, checked: true, paid: e.target.value })}
                                className="h-8 w-28 rounded-md border border-border bg-surface px-2 text-end"
                                aria-label={`Montant versé pour ${monthLabel(new Date(m))}`}
                                data-testid={`sheet-paid-${m.slice(0, 7)}`}
                              />
                              {state.before > 0 && (
                                <span className="text-[11px] text-foreground/55">déjà versé {formatMoney(state.before, unit)}</span>
                              )}
                            </span>
                          )
                        ) : state.before > 0 ? (
                          <span dir="ltr">{formatMoney(state.before, unit)}</span>
                        ) : (
                          <span className="text-foreground/35">—</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-end",
                          (checked || settled) && balance <= 0 ? "text-emerald-700" : "text-foreground/60",
                        )}
                      >
                        {state.locked || state.due <= 0
                          ? "—"
                          : balance <= 0 && (checked || settled)
                            ? "Payé"
                            : formatMoney(Math.max(balance, 0), unit)}
                      </td>
                    </tr>
                    {showSplit && computed && (
                      <tr className="bg-amber-50/50" data-testid="sheet-split-row" data-month={m.slice(0, 7)}>
                        <td colSpan={6} className="px-3 py-2 text-xs">
                          <span className="font-medium text-amber-900">Répartition entre les enfants</span>
                          <span className="text-foreground/60"> (dans l&apos;ordre de la liste, modifiable) :</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-3">
                            {computed.split.map((part) => {
                              const child = entries.find((c) => c.key === part.key);
                              return (
                                <label key={part.key} className="flex items-center gap-1.5">
                                  <span>{child?.firstName}</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    dir="ltr"
                                    value={row.split?.[part.key] ?? ""}
                                    placeholder={fromMru(part.paid, unit)}
                                    onChange={(e) => {
                                      // Taper une part fixe toute la répartition : les autres gardent la proposition.
                                      const base = row.split && Object.values(row.split).some((v) => v.trim())
                                        ? row.split
                                        : Object.fromEntries(computed.split.map((p) => [p.key, fromMru(p.paid, unit)]));
                                      setMonth(m, { ...row, checked: true, split: { ...base, [part.key]: e.target.value } });
                                    }}
                                    className="h-7 w-24 rounded-md border border-border bg-surface px-2 text-end"
                                    data-testid={`sheet-split-${part.key}`}
                                  />
                                  <span className="text-foreground/50">/ {formatMoney(part.due - part.before, unit)}</span>
                                </label>
                              );
                            })}
                            {computed.customSplit && (
                              <button
                                type="button"
                                onClick={() => setMonth(m, { ...row, split: undefined })}
                                className="inline-flex min-h-11 items-center font-medium text-primary-700 hover:underline sm:min-h-0"
                              >
                                Revenir à la répartition proposée
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {settings.prepayLastMonth && lastMonth && draft.months[lastMonth]?.checked && (
          <p className="text-xs font-medium text-amber-800" data-testid="sheet-nb">
            NB : le mois de {monthLabel(new Date(lastMonth)).split(" ")[0]} est payé en avance dès la date d&apos;inscription.
          </p>
        )}

        {/* Frais d'inscription : une ligne par enfant qui paie, séparée des mois. */}
        {fiche.sheets.map(({ key, input }) => {
          if (input.enrollment.due <= 0) return null;
          const child = entries.find((c) => c.key === key);
          const known = existing[key];
          const before = known?.already.enrollment?.paid ?? 0;
          const left = input.enrollment.due - before;
          const a = draft.amounts[key] ?? emptyAmounts();
          return (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-3 py-2 text-sm"
              data-testid="sheet-enrollment-line"
              data-key={key}
            >
              <span className="font-medium">
                Frais d&apos;inscription{paying.length > 1 ? ` — ${child?.firstName ?? ""}` : ""}
                <span className="ms-1 text-xs font-normal text-foreground/60">({formatMoney(input.enrollment.due, unit)})</span>
                {before > 0 && (
                  <span className="block text-xs font-normal text-foreground/60">
                    déjà versé {formatMoney(before, unit)}
                    {known?.enrollmentDates.length ? ` le ${known.enrollmentDates.map(shortDate).join(", ")}` : ""}
                  </span>
                )}
              </span>
              {left > 0 ? (
                <span className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={a.enrollmentDate || today}
                    max={today}
                    onChange={(e) => patchAmounts(key, { enrollmentDate: e.target.value })}
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
                      value={a.enrollmentPaid}
                      placeholder={fromMru(left, unit)}
                      onChange={(e) => patchAmounts(key, { enrollmentPaid: e.target.value })}
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
          );
        })}

        {fiche.errors.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" data-testid="sheet-errors">
            {fiche.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </FormSection>

      {/* Récapitulatif : chaque enfant avec ses montants, puis la simple addition des lignes versées. */}
      <FormSection icon={UsersRound} title="Récapitulatif" bodyClassName="block space-y-3 p-4">
        {multi && <FicheAmountsSummary draft={draft} entries={entries} unit={unit} />}
        {fiche.lines.length === 0 ? (
          <p className="text-sm text-foreground/60">Aucun versement saisi.</p>
        ) : (
          <SheetRecap lines={fiche.lines} totals={fiche.totals} unit={unit} />
        )}
      </FormSection>

      {fiche.totals.paid > 0 && (
        <FormSection icon={Banknote} title="Mode de paiement" bodyClassName="block p-4">
          <PaymentMethodPicker value={method} onChange={onMethodChange} />
        </FormSection>
      )}
    </div>
  );
}


/** Les montants saisis, enfant par enfant (forfait : ceux de la famille, les autres « inclus »). */
export function FicheAmountsSummary({ draft, entries, unit }: { draft: FicheDraft; entries: SheetChild[]; unit: AmountUnit }) {
  return (
    <ul className="space-y-1 text-sm" data-testid="fiche-summary">
      {entries.map((child) => {
        const status = childStatus(draft, entries, child.key);
        const a = draft.amounts[child.key];
        return (
          <li key={child.key} className="flex flex-wrap items-baseline justify-between gap-x-3" data-testid="fiche-summary-child" data-key={child.key}>
            <span className="font-medium text-foreground">
              {`${child.firstName} ${child.lastName}`.trim() || "Enfant sans nom"}
              {child.key === draft.referentKey && entries.length > 1 && (
                <span className="ms-1 text-xs font-normal text-foreground/50">(référent)</span>
              )}
            </span>
            <span className={cn("text-xs", status === "TODO" ? "text-amber-700" : "text-foreground/70")} dir="auto">
              {status === "INCLUDED"
                ? "Inclus dans la fiche familiale"
                : status === "TODO"
                  ? "à saisir"
                  : [
                      a?.monthly ? `${formatMoney(toMru(a.monthly, unit).mru, unit)} / mois` : null,
                      a?.enrollmentDue ? `inscription ${formatMoney(toMru(a.enrollmentDue, unit).mru, unit)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
            </span>
          </li>
        );
      })}
    </ul>
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
