"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, Phone, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { familySurname } from "@/lib/family";
import { formatPhone } from "@/lib/format";
import type { PaymentMethod } from "@/lib/payment-methods";
import { splitFullName } from "@/lib/student-form";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { enrollFamilyChecked, findFamiliesByPhone, type KnownFamily } from "../actions";
import { checkStudentNnis } from "@/app/directeur/eleves/actions";
import type { FamilyPaymentMode } from "../schema";
import {
  childrenStepErrors,
  familyStepErrors,
  newChild,
  toEnrollmentValues,
  type ChildDraft,
  type FamilyDraft,
  type FieldErrors,
} from "./enrollment-draft";
import { FamilyStep } from "./family-step";
import { ChildrenStep, type EnrollmentClassOption } from "./children-step";
import { FamilySheetStep, FicheAmountsSummary, SheetRecap, convertFiche } from "./family-sheet-step";
import { childStatus, emptyAmounts, newFicheDraft, type FicheDraft } from "@/lib/family-fiche";
import { formatMoney } from "@/lib/money";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { billedMonthsFrom } from "@/components/finance/tuition-choice";
import type { TuitionSettings } from "@/lib/tuition-data";
import { clearDraft, loadDraft, useDraftAutosave } from "@/lib/form-draft";
import { DraftBanner } from "@/components/forms/draft-banner";

type Step = 1 | 2 | 3;

const STEP_KEYS = ["family.step.family", "family.step.children", "family.step.payment"] as const;

function Stepper({ step, onGo }: { step: Step; onGo: (step: Step) => void }) {
  const { t } = useLanguage();
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEP_KEYS.map((key, index) => {
        const n = (index + 1) as Step;
        const done = n < step;
        const current = n === step;
        return (
          <li key={key} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => done && onGo(n)}
              disabled={!done}
              aria-current={current ? "step" : undefined}
              className="flex min-w-0 items-center gap-2 disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  done && "bg-primary-600 text-white",
                  current && "bg-primary-800 text-white ring-4 ring-primary-100",
                  !done && !current && "bg-surface-muted text-foreground/45",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
              </span>
              <span
                className={cn(
                  "truncate text-sm font-semibold",
                  current ? "text-primary-900" : done ? "text-primary-700" : "text-foreground/45",
                )}
              >
                {t(key)}
              </span>
            </button>
            {n < 3 && <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-primary-500" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Brouillon de l'inscription d'une famille : tout ce qui a été saisi, étape comprise. */
interface FamilyEnrollmentDraft {
  step: Step;
  draft: FamilyDraft;
  usingKnown: KnownFamily | null;
  children: ChildDraft[];
  mode: FamilyPaymentMode;
  method: PaymentMethod;
  familyNameTouched: boolean;
  /** La fiche de paiement : tous les enfants, forfait famille ou montant par enfant. */
  fiche?: FicheDraft | null;
}

/**
 * Inscription groupée d'une famille. Un parcours à part, ouvert par son
 * propre bouton : l'inscription d'un seul élève reste strictement celle
 * d'avant.
 */
export function FamilyEnrollmentForm({
  classes,
  initialFamily,
  tuitionSettings,
  draftKey,
}: {
  classes: EnrollmentClassOption[];
  /** Montant d'un mois, mois de l'année, juin payé d'avance : proposés pour chaque enfant. */
  tuitionSettings: TuitionSettings;
  /** Famille existante à compléter (?famille=…), sinon null. */
  initialFamily: (KnownFamily & { phone: string }) | null;
  /** Clé du brouillon d'inscription, propre à l'école. */
  draftKey: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();

  const initialDraft = (): FamilyDraft => ({
    existingParentId: initialFamily?.parentId ?? "",
    familyName: initialFamily
      ? (initialFamily.familyName ??
        t("family.defaultName").replace("{name}", initialFamily.parentLastName))
      : "",
    parentName: initialFamily ? `${initialFamily.parentFirstName} ${initialFamily.parentLastName}` : "",
    parentPhone: initialFamily?.phone ?? "",
    parentAddress: initialFamily?.address ?? "",
  });
  const initialChildren = () => [
    newChild(initialFamily ? familySurname(initialFamily.familyName ?? initialFamily.parentLastName) : ""),
  ];

  const [step, setStep] = useState<Step>(initialFamily ? 2 : 1);
  const [draft, setDraft] = useState<FamilyDraft>(initialDraft);
  const [usingKnown, setUsingKnown] = useState<KnownFamily | null>(initialFamily);
  const [known, setKnown] = useState<KnownFamily[]>([]);
  const [familyErrors, setFamilyErrors] = useState<FieldErrors>({});
  const [children, setChildren] = useState<ChildDraft[]>(initialChildren);
  const [childErrors, setChildErrors] = useState<Record<string, FieldErrors>>({});
  const [mode, setMode] = useState<FamilyPaymentMode>("FAMILY");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  // Inscription du jour : premier mois facturé, ce mois-ci (modifiable sur la fiche).
  const [defaultFirstMonth] = useState(() => billedMonthsFrom(tuitionSettings.yearMonths, new Date())[0]);
  const [submitting, setSubmitting] = useState(false);
  // La fiche de paiement de la famille : tous les enfants, forfait famille ou
  // montant par enfant (réglage de l'école par défaut) — le même écran qu'un élève seul.
  const [fiche, setFiche] = useState<FicheDraft | null>(null);
  // Une famille déjà inscrite : ses montants se saisissent sur sa fiche, après l'inscription.
  const existingFamily = Boolean(draft.existingParentId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Le nom de la famille se déduit du parent tant que le directeur ne l'a pas
  // saisi lui-même : « Moussa BA » donne « Famille BA ».
  const familyNameTouched = useRef(Boolean(initialFamily));

  // — Brouillon : la saisie revient après une page fermée ou une coupure de
  // courant, jusqu'à ce que l'inscription soit enregistrée. Un brouillon par
  // famille complétée (?famille=…), un pour une nouvelle famille.
  const storageKey = initialFamily ? `${draftKey}-${initialFamily.parentId}` : draftKey;
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  useEffect(() => {
    const saved = loadDraft<FamilyEnrollmentDraft>(storageKey);
    if (saved) {
      const d = saved.data;
      setStep(d.step);
      setDraft(d.draft);
      setUsingKnown(d.usingKnown);
      if (d.children.length > 0) setChildren(d.children);
      setMode(d.mode);
      setMethod(d.method);
      familyNameTouched.current = d.familyNameTouched;
      if (d.fiche) setFiche(d.fiche);
      setDraftSavedAt(saved.savedAt);
    }
    setDraftReady(true);
    // Relu une seule fois, à l'ouverture de la page.
  }, [storageKey]);

  // Rien de tapé (une famille connue préremplie ne compte pas) : pas de brouillon.
  const isEmptyDraft = useCallback(
    (d: FamilyEnrollmentDraft) => {
      const childTyped = d.children.some((c) => c.firstName.trim() || c.nni.trim() || c.dateOfBirth || c.classId);
      const familyTyped =
        !initialFamily && Boolean(d.draft.familyName.trim() || d.draft.parentName.trim() || d.draft.parentPhone.trim());
      return !childTyped && !familyTyped;
    },
    [initialFamily],
  );
  const autosave = useDraftAutosave<FamilyEnrollmentDraft>(
    storageKey,
    { step, draft, usingKnown, children, mode, method, familyNameTouched: familyNameTouched.current, fiche },
    { enabled: draftReady, isEmpty: isEmptyDraft },
  );

  function discardDraft() {
    clearDraft(storageKey);
    setDraftSavedAt(null);
    setStep(initialFamily ? 2 : 1);
    setDraft(initialDraft());
    setUsingKnown(initialFamily);
    setKnown([]);
    setFamilyErrors({});
    setChildren(initialChildren());
    setChildErrors({});
    setMode("FAMILY");
    setMethod("CASH");
    setFiche(null);
    familyNameTouched.current = Boolean(initialFamily);
  }

  /**
   * La fiche à jour avec les enfants saisis : tous y figurent (référent : le
   * premier, modifiable). Ce qui est déjà tapé est gardé ; un enfant ajouté
   * arrive « à saisir » ; juin est coché d'office si l'école le fait payer à
   * l'inscription.
   */
  function syncFiche(list: ChildDraft[]) {
    const keys = list.map((c) => c.key);
    const last = tuitionSettings.yearMonths[tuitionSettings.yearMonths.length - 1];
    setFiche((current) => {
      if (!current) {
        return newFicheDraft({
          mode: tuitionSettings.familySheetMode,
          referentKey: keys[0],
          keys,
          unit: tuitionSettings.amountUnit,
          monthlyMru: tuitionSettings.monthly,
          prepaid: tuitionSettings.prepayLastMonth && last ? [last] : [],
          firstMonth: defaultFirstMonth,
        });
      }
      const referentKey = keys.includes(current.referentKey) ? current.referentKey : keys[0];
      return {
        ...current,
        referentKey,
        amounts: Object.fromEntries(keys.map((k) => [k, current.amounts[k] ?? emptyAmounts()])),
      };
    });
  }

  // Famille déjà enregistrée avec ce numéro : recherchée dès que le numéro
  // est complet, pour proposer de la compléter.
  const phoneDigits = draft.parentPhone.replace(/\D/g, "");
  useEffect(() => {
    if (usingKnown || phoneDigits.length < 8) {
      setKnown([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      findFamiliesByPhone(phoneDigits)
        .then((found) => !cancelled && setKnown(found))
        .catch(() => !cancelled && setKnown([]));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneDigits, usingKnown]);

  function patchDraft(patch: Partial<FamilyDraft>) {
    if ("familyName" in patch) familyNameTouched.current = true;
    setDraft((d) => {
      const next = { ...d, ...patch };
      if ("parentName" in patch && !familyNameTouched.current) {
        const lastName = splitFullName(patch.parentName ?? "").lastName;
        next.familyName = lastName ? t("family.defaultName").replace("{name}", lastName) : "";
      }
      return next;
    });
    setFamilyErrors((e) => {
      const next = { ...e };
      for (const field of Object.keys(patch)) delete next[field];
      return next;
    });
  }

  function chooseKnownFamily(family: KnownFamily) {
    familyNameTouched.current = true;
    setUsingKnown(family);
    setDraft((d) => ({
      ...d,
      existingParentId: family.parentId,
      familyName: family.familyName ?? t("family.defaultName").replace("{name}", family.parentLastName),
      parentName: `${family.parentFirstName} ${family.parentLastName}`,
      parentAddress: family.address ?? d.parentAddress,
    }));
    setFamilyErrors({});
  }

  function leaveKnownFamily() {
    setUsingKnown(null);
    setDraft((d) => ({ ...d, existingParentId: "", parentName: "", parentAddress: "" }));
  }

  function patchChild(key: string, patch: Partial<ChildDraft>) {
    setChildren((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
    setChildErrors((errors) => {
      if (!errors[key]) return errors;
      const next = { ...errors[key] };
      for (const field of Object.keys(patch)) delete next[field];
      return { ...errors, [key]: next };
    });
  }

  function goToChildren() {
    const errors = familyStepErrors(draft);
    setFamilyErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(t("family.fixErrors"));
      return;
    }
    // Le nom des enfants est prérempli d'après la famille, s'il est encore vide.
    const surname = familySurname(draft.familyName);
    setChildren((list) => list.map((c) => (c.lastName ? c : { ...c, lastName: surname })));
    setStep(2);
  }

  async function goToPayment() {
    const errors = childrenStepErrors(children);
    setChildErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(t("family.fixErrors"));
      return;
    }
    // Un NNI déjà connu de l'école (ou saisi deux fois) : on le dit sur
    // l'enfant concerné, avant d'aller plus loin.
    const withNni = children.filter((c) => c.nni.trim());
    if (withNni.length > 0) {
      const conflict = await checkStudentNnis(withNni.map((c) => c.nni));
      if (conflict) {
        const digits = conflict.match(/\d{10}/)?.[0];
        const child =
          withNni.find((c) => c.nni.replace(/[\s.-]/g, "") === digits) ?? withNni[0];
        setChildErrors({ [child.key]: { nni: conflict } });
        toast.error(conflict);
        return;
      }
    }
    if (!existingFamily) syncFiche(children);
    setStep(3);
  }

  // Brouillon repris à l'étape 3 sans fiche : on la crée.
  useEffect(() => {
    if (step === 3 && !fiche && !existingFamily) syncFiche(children);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, fiche, existingFamily]);

  // Fiches converties en MRU : récapitulatif, confirmation et enregistrement
  // lisent les mêmes lignes.
  const converted =
    fiche && !existingFamily
      ? convertFiche(fiche, children, tuitionSettings.amountUnit, tuitionSettings.yearMonths, defaultFirstMonth)
      : null;
  const sheetErrorsList = converted?.errors ?? [];
  const recapLines = converted?.lines ?? [];
  const recapTotals = converted?.totals ?? { paid: 0, balance: 0 };
  const shownTotal = recapTotals.paid;

  async function submit() {
    setSubmitting(true);
    try {
      const outcome = await enrollFamilyChecked(
        toEnrollmentValues(
          draft,
          children,
          "FAMILY",
          method,
          converted?.sheets.map((s) => s.input),
          fiche && converted
            ? { mode: fiche.mode, referentIndex: Math.max(0, children.findIndex((c) => c.key === fiche.referentKey)) }
            : undefined,
        ),
      );
      if (!outcome.ok) {
        // La fiche reste à l'écran, telle que saisie : on peut réessayer.
        toast.error(outcome.error);
        setConfirmOpen(false);
        setSubmitting(false);
        return;
      }
      const result = outcome;
      // Inscription enregistrée : le brouillon n'a plus lieu d'être.
      autosave.finish();
      toast.success(t("family.enrolled").replace("{count}", String(result.studentIds.length)));
      // Une famille déjà inscrite : sa fiche, où les nouveaux enfants attendent leurs montants.
      if (existingFamily) {
        router.push(`/directeur/fiche?famille=${result.parentId}`);
        return;
      }
      // Un reçu : on l'ouvre. Plusieurs (une date par reçu) : la famille, avec tout son historique.
      router.push(
        (result.receiptCount ?? 0) > 1
          ? `/directeur/familles/${result.parentId}`
          : result.familyPaymentId
            ? `/directeur/finance/recus/famille/${result.familyPaymentId}`
            : result.paymentIds[0]
              ? `/directeur/finance/recus/${result.paymentIds[0]}`
              : `/directeur/familles/${result.parentId}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
      setSubmitting(false);
    }
  }

  const namedChildren = children.filter((c) => c.firstName.trim());

  return (
    <div className="space-y-5">
      {draftSavedAt && <DraftBanner savedAt={draftSavedAt} onDiscard={discardDraft} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav aria-label={t("nav.category.schooling")} className="mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50">
            <span>{t("nav.category.schooling")}</span>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <Link href="/directeur/eleves" className="hover:text-foreground">
              {t("nav.students")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="font-medium text-foreground/70">{t("family.enrollTitle")}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <UsersRound className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("family.enrollTitle")}</h1>
              <p className="mt-0.5 text-sm text-foreground/60">{t("family.enrollSubtitle")}</p>
            </div>
          </div>
        </div>
        <Link
          href="/directeur/eleves"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/55 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("family.backToStudents")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-4 rounded-2xl border border-border/70 bg-surface/90 p-4 shadow-soft backdrop-blur-sm sm:p-5">
          <Stepper step={step} onGo={setStep} />
          <p className="text-xs font-medium text-foreground/45">{t("family.stepOf").replace("{n}", String(step))}</p>

          {classes.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("family.noClasses")}</p>
          ) : step === 1 ? (
            <FamilyStep
              draft={draft}
              errors={familyErrors}
              onChange={patchDraft}
              known={known}
              usingKnown={usingKnown}
              onUseKnown={chooseKnownFamily}
              onLeaveKnown={leaveKnownFamily}
            />
          ) : step === 2 ? (
            <ChildrenStep
              entries={children}
              errors={childErrors}
              classes={classes}
              onChange={patchChild}
              onAdd={() => setChildren((list) => [...list, newChild(familySurname(draft.familyName))])}
              onRemove={(key) => setChildren((list) => list.filter((c) => c.key !== key))}
            />
          ) : existingFamily ? (
            <p className="rounded-xl bg-primary-50/70 px-4 py-3 text-sm text-primary-900" data-testid="fiche-existing-family">
              Cette famille a déjà sa fiche de paiement. Les enfants ajoutés y apparaîtront avec leurs champs à remplir :
              elle s&apos;ouvre juste après l&apos;inscription, sans rien changer aux montants déjà saisis.
            </p>
          ) : fiche ? (
            <FamilySheetStep
              entries={children}
              classes={classes}
              settings={tuitionSettings}
              yearMonths={tuitionSettings.yearMonths}
              defaultFirstMonth={defaultFirstMonth}
              draft={fiche}
              onDraftChange={setFiche}
              method={method}
              onMethodChange={setMethod}
            />
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-between">
            {step > 1 ? (
              <Button type="button" variant="secondary" onClick={() => setStep((s) => (s - 1) as Step)} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                {t("family.back")}
              </Button>
            ) : (
              <span />
            )}
            {step === 1 && (
              <Button type="button" onClick={goToChildren} disabled={classes.length === 0}>
                {t("family.next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            )}
            {step === 2 && (
              <Button type="button" onClick={goToPayment}>
                {t("family.next")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            )}
            {step === 3 && (
              // Rien n'est enregistré avant la confirmation.
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={submitting || sheetErrorsList.length > 0}
                className="sm:min-w-56"
                data-testid="sheet-review"
              >
                <Check className="h-4 w-4" />
                {recapTotals.paid > 0
                  ? `Vérifier et encaisser ${formatMoney(recapTotals.paid, tuitionSettings.amountUnit)}`
                  : t("family.submit").replace("{count}", String(children.length))}
              </Button>
            )}
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-border/70 bg-surface/90 p-5 shadow-soft backdrop-blur-sm lg:sticky lg:top-24">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary-700">{t("family.summary")}</h2>
          <div>
            <p className="text-lg font-bold text-primary-900">{draft.familyName || "—"}</p>
            {draft.parentName && <p className="text-sm text-foreground/70">{draft.parentName}</p>}
            {phoneDigits.length >= 8 && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/55">
                <Phone className="h-3.5 w-3.5" />
                <span dir="ltr">{formatPhone(`+${phoneDigits.length === 8 ? `222${phoneDigits}` : phoneDigits}`)}</span>
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground/60">
              {t("family.childCount").replace("{count}", String(children.length))}
            </p>
            {namedChildren.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {namedChildren.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-foreground">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {c.classId && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                          {classes.find((cl) => cl.id === c.classId)?.name}
                        </span>
                      )}
                      {step === 3 && fiche && (
                        <AsideChildAmounts fiche={fiche} childKey={c.key} entries={children} unit={tuitionSettings.amountUnit} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border/70 pt-3">
            <span className="text-sm font-semibold text-foreground/70">{t("family.total")}</span>
            <span dir="ltr" className="text-xl font-bold text-primary-800" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatMoney(shownTotal, tuitionSettings.amountUnit)}
            </span>
          </div>
        </aside>
      </div>

      {/* Confirmation : le récapitulatif, puis l'encaissement — « Annuler » n'enregistre rien. */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !submitting && setConfirmOpen(open)}>
        <DialogContent className="max-w-lg" data-testid="sheet-confirm">
          <DialogHeader>
            <DialogTitle>Confirmer la fiche de paiement</DialogTitle>
            <DialogDescription>
              {draft.familyName} · {children.length} élève(s) inscrit(s)
            </DialogDescription>
          </DialogHeader>
          {fiche && children.length > 1 && !existingFamily && (
            <FicheAmountsSummary draft={fiche} entries={children} unit={tuitionSettings.amountUnit} />
          )}
          {recapLines.length > 0 ? (
            <SheetRecap lines={recapLines} totals={recapTotals} unit={tuitionSettings.amountUnit} />
          ) : (
            <p className="text-sm text-foreground/60">Rien n&apos;est versé aujourd&apos;hui : seule l&apos;inscription des enfants est enregistrée.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting} data-testid="sheet-cancel">
              Annuler
            </Button>
            <Button type="button" onClick={submit} disabled={submitting} data-testid="sheet-confirm-button">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {recapTotals.paid > 0
                ? `Confirmer l'encaissement de ${formatMoney(recapTotals.paid, tuitionSettings.amountUnit)}`
                : "Confirmer l'inscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Dans le récapitulatif de droite : ce qui est saisi pour cet enfant, gardé quand on passe au suivant. */
function AsideChildAmounts({
  fiche,
  childKey,
  entries,
  unit,
}: {
  fiche: FicheDraft;
  childKey: string;
  entries: ChildDraft[];
  unit: "MRU" | "MRO";
}) {
  const status = childStatus(fiche, entries, childKey);
  const a = fiche.amounts[childKey];
  return (
    <span
      className={cn("text-xs font-medium", status === "TODO" ? "text-amber-700" : status === "DONE" ? "text-emerald-700" : "text-foreground/50")}
      data-testid="aside-child-status"
      dir="auto"
    >
      {status === "INCLUDED" ? "Inclus" : status === "TODO" ? "à saisir" : `✓ ${a?.monthly || "0"} ${unit}`}
    </span>
  );
}
