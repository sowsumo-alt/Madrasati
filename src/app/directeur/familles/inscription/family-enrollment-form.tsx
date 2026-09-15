"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, Phone, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { familySurname, familyTotal, parseAmount } from "@/lib/family";
import { formatMRU, formatPhone, ltrIsolate } from "@/lib/format";
import type { PaymentMethod } from "@/lib/payment-methods";
import { splitFullName } from "@/lib/student-form";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { enrollFamily, findFamiliesByPhone, type KnownFamily } from "../actions";
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
import { PaymentStep } from "./payment-step";

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

/**
 * Inscription groupée d'une famille. Un parcours à part, ouvert par son
 * propre bouton : l'inscription d'un seul élève reste strictement celle
 * d'avant.
 */
export function FamilyEnrollmentForm({
  classes,
  initialFamily,
}: {
  classes: EnrollmentClassOption[];
  /** Famille existante à compléter (?famille=…), sinon null. */
  initialFamily: (KnownFamily & { phone: string }) | null;
}) {
  const router = useRouter();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>(initialFamily ? 2 : 1);
  const [draft, setDraft] = useState<FamilyDraft>(() => ({
    existingParentId: initialFamily?.parentId ?? "",
    familyName: initialFamily
      ? (initialFamily.familyName ??
        t("family.defaultName").replace("{name}", initialFamily.parentLastName))
      : "",
    parentName: initialFamily ? `${initialFamily.parentFirstName} ${initialFamily.parentLastName}` : "",
    parentPhone: initialFamily?.phone ?? "",
    parentAddress: initialFamily?.address ?? "",
  }));
  const [usingKnown, setUsingKnown] = useState<KnownFamily | null>(initialFamily);
  const [known, setKnown] = useState<KnownFamily[]>([]);
  const [familyErrors, setFamilyErrors] = useState<FieldErrors>({});
  const [children, setChildren] = useState<ChildDraft[]>(() => [
    newChild(initialFamily ? familySurname(initialFamily.familyName ?? initialFamily.parentLastName) : ""),
  ]);
  const [childErrors, setChildErrors] = useState<Record<string, FieldErrors>>({});
  const [mode, setMode] = useState<FamilyPaymentMode>("FAMILY");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [submitting, setSubmitting] = useState(false);
  // Le nom de la famille se déduit du parent tant que le directeur ne l'a pas
  // saisi lui-même : « Moussa BA » donne « Famille BA ».
  const familyNameTouched = useRef(Boolean(initialFamily));

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

  function goToPayment() {
    const errors = childrenStepErrors(children);
    setChildErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(t("family.fixErrors"));
      return;
    }
    setStep(3);
  }

  const total = familyTotal(children.map((c) => c.amount));
  const payingChildren = children.filter((c) => parseAmount(c.amount) > 0).length;
  // Avec un seul enfant qui paie, un reçu « familial » n'apporterait rien.
  const effectiveMode: FamilyPaymentMode = payingChildren > 1 ? mode : "SEPARATE";

  async function submit() {
    setSubmitting(true);
    try {
      const result = await enrollFamily(toEnrollmentValues(draft, children, effectiveMode, method));
      toast.success(t("family.enrolled").replace("{count}", String(result.studentIds.length)));
      router.push(
        result.familyPaymentId
          ? `/directeur/finance/recus/famille/${result.familyPaymentId}`
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
          ) : (
            <PaymentStep
              entries={children}
              classes={classes}
              onAmountChange={(key, amount) => patchChild(key, { amount })}
              mode={mode}
              onModeChange={setMode}
              method={method}
              onMethodChange={setMethod}
            />
          )}

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
              <Button type="button" onClick={submit} disabled={submitting} className="sm:min-w-56">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {total > 0
                  ? t("family.submitPay").replace("{amount}", ltrIsolate(formatMRU(total)))
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
                      {parseAmount(c.amount) > 0 && (
                        <span dir="ltr" className="text-xs font-medium text-foreground/60" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatMRU(parseAmount(c.amount))}
                        </span>
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
              {formatMRU(total)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
