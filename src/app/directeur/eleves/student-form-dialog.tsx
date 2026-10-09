"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CircleCheck,
  Globe,
  IdCard,
  GraduationCap,
  Loader2,
  MapPin,
  Phone,
  School,
  UserRound,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_NATIONALITY, NATIONALITY_SUGGESTIONS } from "@/lib/student-form";
import { ClassSelectItems } from "@/components/classes/class-select-items";
import { useLanguage } from "@/lib/i18n/language-provider";
import { studentSchema, type StudentFormValues } from "./schema";
import { createStudent, updateStudent, findDuplicateStudents, type DuplicateStudent, checkStudentNnis } from "./actions";
import { FormSection } from "@/components/forms/form-section";
import { billedMonthsFrom } from "@/components/finance/tuition-choice";
import { FamilySheetStep, SheetRecap, convertFiche, type SheetChild } from "@/app/directeur/familles/inscription/family-sheet-step";
import { newFicheDraft, type FicheDraft } from "@/lib/family-fiche";
import { formatMoney } from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";
import { DialogFooter, DialogHeader } from "@/components/ui/dialog";
import type { TuitionSettings } from "@/lib/tuition-data";
import { clearDraft, loadDraft, useDraftAutosave } from "@/lib/form-draft";
import { DraftBanner } from "@/components/forms/draft-banner";
import { FormField, IconInput } from "@/components/forms/form-field";
import { PhotoAvatarPicker } from "./student-form/photo-avatar-picker";
import { STATUS_KEYS, STUDENT_STATUSES } from "./students-list/student-status";
import { useSubmissionKeys } from "@/lib/submission-key";

export interface StudentClassOption {
  id: string;
  name: string;
  /** Pour regrouper la liste par catégorie (voir classOptions). */
  category?: string | null;
}

export interface StudentEditTarget {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  classId: string | null;
  status: string;
  photoUrl: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  nni: string | null;
  rimNumber: string | null;
  motherName: string | null;
  enrollmentDate: string | null;
  parentName: string;
  parentPhone: string;
  parentAddress: string;
}

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: StudentClassOption[];
  editTarget?: StudentEditTarget | null;
  /** Année des classes proposées, affichée en lecture seule. */
  currentYearLabel: string | null;
  /** Frais de scolarité d'un mois de l'école (Paramètres), proposés à l'inscription. */
  tuitionSettings: TuitionSettings;
  /** Clé du brouillon de l'inscription en cours (par école). */
  draftKey: string;
}

/**
 * Valeurs d'un nouveau dossier : la date d'inscription du jour et la
 * nationalité la plus courante sont déjà remplies, le directeur n'a qu'à
 * les corriger au besoin.
 */
function newStudentValues(): StudentFormValues {
  return {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    placeOfBirth: "",
    nationality: DEFAULT_NATIONALITY,
    nni: "",
    rimNumber: "",
    classId: "",
    status: "ACTIVE",
    enrollmentDate: new Date().toISOString().slice(0, 10),
    photoUrl: null,
    parentName: "",
    parentPhone: "",
    parentAddress: "",
    motherName: "",
  };
}

/** Brouillon d'une inscription : la saisie et la fiche de paiement. */
interface StudentDraft {
  values: StudentFormValues;
  fiche?: FicheDraft;
  method?: PaymentMethod;
}

/** Fiche de paiement d'un nouvel élève (une fiche à un enfant) : le montant de l'école, juin coché s'il est payé d'avance. */
function freshSheet(settings: TuitionSettings): FicheDraft {
  const last = settings.yearMonths[settings.yearMonths.length - 1];
  return newFicheDraft({
    mode: "FAMILY",
    referentKey: "solo",
    keys: ["solo"],
    monthlyMru: settings.monthly,
    unit: settings.amountUnit,
    prepaid: settings.prepayLastMonth && last ? [last] : [],
  });
}

/** Rien de tapé : pas de brouillon à garder. */
function isEmptyStudentDraft({ values }: StudentDraft) {
  return ![
    values.firstName,
    values.lastName,
    values.dateOfBirth,
    values.placeOfBirth,
    values.nni,
    values.rimNumber,
    values.parentName,
    values.parentPhone,
    values.parentAddress,
    values.motherName,
    values.photoUrl,
  ].some((v) => typeof v === "string" && v.trim());
}

/**
 * Formulaire d'inscription et de modification d'un élève, en blocs comme sur
 * la maquette : informations personnelles, scolaires, parents, puis frais
 * d'inscription (création seulement).
 */
export function StudentFormDialog({
  open,
  onOpenChange,
  classes,
  editTarget,
  currentYearLabel,
  tuitionSettings,
  draftKey,
}: StudentFormDialogProps) {
  const router = useRouter();
  const submission = useSubmissionKeys();
  const { t } = useLanguage();
  const isEdit = Boolean(editTarget);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: newStudentValues(),
  });

  // La fiche de paiement de l'élève : le même écran et le même calcul qu'une famille.
  const [sheet, setSheet] = useState<FicheDraft>(() => freshSheet(tuitionSettings));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  // Valeurs en attente de la confirmation de l'encaissement.
  const [pending, setPending] = useState<StudentFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateStudent[]>([]);
  const [duplicateAck, setDuplicateAck] = useState(false);
  // Brouillon : relu à l'ouverture, gardé à chaque frappe tant que
  // l'inscription n'est pas enregistrée (jamais pour une modification).
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setDraftReady(false);
      return;
    }
    if (open) {
      setDuplicates([]);
      setDuplicateAck(false);
      const saved = editTarget ? null : loadDraft<StudentDraft>(draftKey);
      setDraftSavedAt(saved?.savedAt ?? null);
      setDraftReady(!editTarget);
      if (saved) {
        reset({ ...newStudentValues(), ...saved.data.values });
        setSheet(saved.data.fiche ?? freshSheet(tuitionSettings));
        setMethod(saved.data.method ?? "CASH");
        return;
      }
      setSheet(freshSheet(tuitionSettings));
      setMethod("CASH");
      reset(
        editTarget
          ? {
              firstName: editTarget.firstName,
              lastName: editTarget.lastName,
              dateOfBirth: editTarget.dateOfBirth ?? "",
              gender: editTarget.gender ?? "",
              placeOfBirth: editTarget.placeOfBirth ?? "",
              // Pas de nationalité préremplie sur un dossier existant : elle
              // serait enregistrée sans que personne ne l'ait vérifiée.
              nationality: editTarget.nationality ?? "",
              nni: editTarget.nni ?? "",
              rimNumber: editTarget.rimNumber ?? "",
              classId: editTarget.classId ?? "",
              status: editTarget.status as StudentFormValues["status"],
              enrollmentDate: editTarget.enrollmentDate ?? "",
              photoUrl: editTarget.photoUrl ?? null,
              parentName: editTarget.parentName,
              parentPhone: editTarget.parentPhone,
              parentAddress: editTarget.parentAddress,
              motherName: editTarget.motherName ?? "",
            }
          : newStudentValues(),
      );
    }
  }, [open, editTarget, reset, tuitionSettings, draftKey]);

  const allValues = watch();
  const autosave = useDraftAutosave<StudentDraft>(
    draftKey,
    { values: allValues, fiche: sheet, method },
    { enabled: open && !isEdit && draftReady, isEmpty: isEmptyStudentDraft },
  );

  function discardDraft() {
    clearDraft(draftKey);
    setDraftSavedAt(null);
    setSheet(freshSheet(tuitionSettings));
    setMethod("CASH");
    reset(newStudentValues());
  }

  async function onSubmit(values: StudentFormValues) {
    try {
      // Avertissement de doublon avant la première création seulement : à la
      // seconde tentative le directeur a vu le nom déjà inscrit et tranché.
      if (!isEdit && !duplicateAck) {
        const found = await findDuplicateStudents(values.firstName, values.lastName);
        if (found.length > 0) {
          setDuplicates(found);
          return;
        }
      }

      if (values.nni) {
        const conflict = await checkStudentNnis([values.nni], editTarget?.id);
        if (conflict) {
          setError("nni", { message: conflict });
          return;
        }
      }

      if (isEdit && editTarget) {
        await updateStudent(editTarget.id, values);
        toast.success(t("students.updatedSuccess"));
      } else {
        if (sheetErrorsList.length > 0) {
          toast.error(sheetErrorsList[0]);
          return;
        }
        // De l'argent versé : le récapitulatif d'abord, comme pour une famille.
        if (recapTotals.paid > 0) {
          setPending(values);
          return;
        }
        await enroll(values);
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    }
  }

  /** Enregistre l'élève et sa fiche ; « Annuler » sur la confirmation n'enregistre rien. */
  async function enroll(values: StudentFormValues) {
    setSaving(true);
    try {
      const result = await createStudent(values, hasSheet ? converted.sheets[0].input : undefined, method, submission.keyFor());
      if (!result.ok) {
        toast.error(result.error);
        setPending(null);
        return;
      }
      submission.done();
      // Inscription enregistrée : le brouillon n'a plus lieu d'être.
      autosave.finish();
      setDraftSavedAt(null);
      setPending(null);
      if (result.receiptCount > 1) {
        toast.success(t("students.enrolledWithReceipt"));
        onOpenChange(false);
        router.refresh();
        return;
      }
      if (result.paymentId) {
        // Navigation dans le même onglet, et non window.open : le geste de
        // l'utilisateur a expiré pendant l'attente du serveur, si bien que
        // le navigateur bloquait l'ouverture en arrière-plan sans rien
        // dire. Le directeur ne voyait jamais le reçu et devait aller le
        // chercher dans Finance.
        toast.success(t("students.enrolledWithReceipt"));
        onOpenChange(false);
        router.push(`/directeur/finance/recus/${result.paymentId}`);
        return;
      }
      toast.success(t("students.createdSuccess"));
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const classId = watch("classId");
  const gender = watch("gender");
  const status = watch("status");
  const photoUrl = watch("photoUrl") ?? null;
  const enrollmentDate = watch("enrollmentDate");
  // Premier mois facturé proposé : le mois de la date d'inscription.
  const defaultFirstMonth = billedMonthsFrom(
    tuitionSettings.yearMonths,
    enrollmentDate ? new Date(enrollmentDate) : new Date(),
  )[0];
  const soloChild: SheetChild = {
    key: "solo",
    firstName: watch("firstName") ?? "",
    lastName: watch("lastName") ?? "",
    classId: classId ?? "",
    rimNumber: watch("rimNumber") ?? "",
  };
  const converted = convertFiche(sheet, [soloChild], tuitionSettings.amountUnit, tuitionSettings.yearMonths, defaultFirstMonth);
  const sheetErrorsList = converted.errors;
  const recapLines = converted.lines;
  const recapTotals = converted.totals;
  // Une fiche sans aucun montant : l'élève est inscrit, sa fiche se fera plus tard.
  const hasSheet = Boolean(converted.sheets[0]) && (converted.sheets[0].input.monthly > 0 || converted.sheets[0].input.enrollment.due > 0);
  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] max-w-2xl flex-col overflow-y-hidden p-0"
        // Un clic à côté ne ferme plus une inscription en cours : on la
        // perdait d'un geste. Annuler, la croix ou Échap restent possibles,
        // et la saisie reste de toute façon en brouillon.
        onInteractOutside={(e) => {
          if (!isEdit) e.preventDefault();
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex items-center gap-4 border-b border-border px-5 py-4 pe-12 sm:px-6">
            <PhotoAvatarPicker
              value={photoUrl}
              onChange={(v) => setValue("photoUrl", v, { shouldDirty: true })}
              addLabel={t("students.addPhoto")}
              changeLabel={t("students.changePhoto")}
              removeLabel={t("students.removePhoto")}
            />
            <div className="min-w-0">
              <DialogTitle className="text-lg">
                {isEdit ? t("students.edit") : t("students.new")}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {isEdit ? t("students.editDescription") : t("students.newDescription")}
              </DialogDescription>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-muted/30 px-5 py-5 sm:px-6">
            {!isEdit && draftSavedAt && <DraftBanner savedAt={draftSavedAt} onDiscard={discardDraft} />}
            <FormSection icon={UserRound} title={t("students.sectionPersonal")}>
              <FormField
                label={t("students.firstName")}
                htmlFor="firstName"
                required
                error={errors.firstName?.message}
              >
                <Input
                  id="firstName"
                  placeholder={t("students.firstNamePlaceholder")}
                  {...register("firstName")}
                />
              </FormField>
              <FormField
                label={t("students.lastName")}
                htmlFor="lastName"
                required
                error={errors.lastName?.message}
              >
                <Input
                  id="lastName"
                  placeholder={t("students.lastNamePlaceholder")}
                  {...register("lastName")}
                />
              </FormField>
              <FormField label={t("students.dateOfBirth")} htmlFor="dateOfBirth">
                <DateInput id="dateOfBirth" {...register("dateOfBirth")} />
              </FormField>
              <FormField
                label={t("students.gender")}
                htmlFor="student-gender-select"
                required
                error={errors.gender?.message}
              >
                <Select
                  value={gender || undefined}
                  onValueChange={(v) => setValue("gender", v, { shouldValidate: true })}
                >
                  <SelectTrigger id="student-gender-select">
                    <span className="flex min-w-0 items-center gap-2">
                      <UserRound className="h-4 w-4 shrink-0 text-foreground/40" />
                      <SelectValue placeholder={t("students.selectPlaceholder")}>
                        {gender === "M"
                          ? t("students.gender.M")
                          : gender === "F"
                            ? t("students.gender.F")
                            : undefined}
                      </SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">{t("students.gender.M")}</SelectItem>
                    <SelectItem value="F">{t("students.gender.F")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("students.placeOfBirth")} htmlFor="placeOfBirth">
                <IconInput
                  icon={MapPin}
                  id="placeOfBirth"
                  placeholder={t("students.placeOfBirthPlaceholder")}
                  {...register("placeOfBirth")}
                />
              </FormField>
              <FormField label={t("students.nationality")} htmlFor="nationality">
                {/* Liste de suggestions et non liste fermée : toute nationalité
                    reste possible, sans option « Autre » qui perdrait l'information. */}
                <IconInput
                  icon={Globe}
                  id="nationality"
                  list="student-nationality-suggestions"
                  autoComplete="off"
                  {...register("nationality")}
                />
                <datalist id="student-nationality-suggestions">
                  {NATIONALITY_SUGGESTIONS.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </FormField>
              <FormField label={t("students.nni")} htmlFor="nni" error={errors.nni?.message}>
                <IconInput
                  icon={IdCard}
                  id="nni"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  dir="ltr"
                  placeholder={t("students.nniPlaceholder")}
                  {...register("nni")}
                />
              </FormField>
              <FormField label={t("students.rimNumber")} htmlFor="rimNumber">
                <IconInput
                  icon={IdCard}
                  id="rimNumber"
                  autoComplete="off"
                  maxLength={30}
                  dir="ltr"
                  {...register("rimNumber")}
                />
              </FormField>
            </FormSection>

            <FormSection icon={GraduationCap} title={t("students.sectionSchool")}>
              <FormField
                label={t("students.class")}
                htmlFor="student-class-select"
                required
                error={
                  classes.length === 0 ? t("students.createClassFirst") : errors.classId?.message
                }
              >
                {/* Plus d'option « Sans classe » : elle était le choix par défaut,
                    et un élève enregistré ainsi disparaissait des appels et des
                    bulletins sans que rien ne l'indique au directeur. */}
                <Select
                  value={classId || undefined}
                  onValueChange={(v) => setValue("classId", v, { shouldValidate: true })}
                  disabled={classes.length === 0}
                >
                  <SelectTrigger id="student-class-select">
                    <span className="flex min-w-0 items-center gap-2">
                      <School className="h-4 w-4 shrink-0 text-foreground/40" />
                      <SelectValue placeholder={t("students.selectClass")}>
                        {selectedClass?.name}
                      </SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <ClassSelectItems classes={classes} />
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("students.status")} htmlFor="student-status-select">
                <Select
                  value={status}
                  onValueChange={(v) => setValue("status", v as StudentFormValues["status"])}
                >
                  <SelectTrigger id="student-status-select">
                    <span className="flex min-w-0 items-center gap-2">
                      <CircleCheck className="h-4 w-4 shrink-0 text-foreground/40" />
                      <SelectValue>{t(STATUS_KEYS[status])}</SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {STUDENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(STATUS_KEYS[s])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("students.enrollmentDate")} htmlFor="enrollmentDate">
                <DateInput id="enrollmentDate" {...register("enrollmentDate")} />
              </FormField>
              <FormField label={t("students.schoolYear")} htmlFor="student-school-year">
                {/* Déduite, pas choisie : les classes proposées sont toutes celles
                    de l'année en cours. */}
                <IconInput
                  icon={CalendarRange}
                  id="student-school-year"
                  value={currentYearLabel ?? "—"}
                  readOnly
                  tabIndex={-1}
                  className="bg-surface-muted/60 text-foreground/70"
                />
              </FormField>
            </FormSection>

            <FormSection icon={Users} title={t("students.sectionParents")}>
              <FormField
                label={t("students.fatherName")}
                htmlFor="parentName"
                error={errors.parentName?.message}
              >
                <Input
                  id="parentName"
                  placeholder={t("students.fatherNamePlaceholder")}
                  {...register("parentName")}
                />
              </FormField>
              <FormField
                label={t("students.parentPhone")}
                htmlFor="parentPhone"
                error={errors.parentPhone?.message}
              >
                <IconInput
                  icon={Phone}
                  id="parentPhone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="+222 12 34 56 78"
                  {...register("parentPhone")}
                />
              </FormField>
              <FormField label={t("students.motherName")} htmlFor="motherName">
                <Input
                  id="motherName"
                  placeholder={t("students.motherNamePlaceholder")}
                  {...register("motherName")}
                />
              </FormField>
              <FormField
                label={t("students.address")}
                htmlFor="parentAddress"
                error={errors.parentAddress?.message}
              >
                <IconInput
                  icon={MapPin}
                  id="parentAddress"
                  placeholder={t("students.addressPlaceholder")}
                  {...register("parentAddress")}
                />
              </FormField>
            </FormSection>

            {!isEdit && (
              <div className="sm:col-span-2">
                <FamilySheetStep
                  entries={[soloChild]}
                  classes={classes}
                  settings={tuitionSettings}
                  yearMonths={tuitionSettings.yearMonths}
                  defaultFirstMonth={defaultFirstMonth}
                  draft={sheet}
                  onDraftChange={setSheet}
                  method={method}
                  onMethodChange={setMethod}
                />
              </div>
            )}

            {duplicates.length > 0 && !duplicateAck && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-xs text-amber-900">
                  <p className="font-medium">{t("students.duplicateTitle")}</p>
                  <ul className="mt-1 space-y-0.5 text-amber-800/80">
                    {duplicates.map((d) => (
                      <li key={d.id}>
                        {d.name}
                        {d.className ? ` — ${d.className}` : ` — ${t("students.noClass")}`}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-amber-800/80">{t("students.duplicateHint")}</p>
                  <button
                    type="button"
                    onClick={() => setDuplicateAck(true)}
                    className="mt-2 rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
                  >
                    {t("students.duplicateConfirm")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button
              type="button"
              variant="secondary"
              className="sm:min-w-28"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || saving} className="sm:min-w-36">
              {isSubmitting || saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Confirmation : le récapitulatif, puis l'encaissement — « Annuler » n'enregistre rien. */}
      <Dialog open={pending !== null} onOpenChange={(o) => !saving && !o && setPending(null)}>
        <DialogContent className="max-w-lg" data-testid="sheet-confirm">
          <DialogHeader>
            <DialogTitle>Confirmer la fiche de paiement</DialogTitle>
            <DialogDescription>
              {soloChild.firstName} {soloChild.lastName} · 1 élève inscrit
            </DialogDescription>
          </DialogHeader>
          <SheetRecap lines={recapLines} totals={recapTotals} unit={tuitionSettings.amountUnit} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPending(null)} disabled={saving} data-testid="sheet-cancel">
              Annuler
            </Button>
            <Button type="button" onClick={() => pending && enroll(pending)} disabled={saving} data-testid="sheet-confirm-button">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmer l&apos;encaissement de {formatMoney(recapTotals.paid, tuitionSettings.amountUnit)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
