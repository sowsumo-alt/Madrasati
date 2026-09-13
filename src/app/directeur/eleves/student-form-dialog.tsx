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
  GraduationCap,
  Loader2,
  MapPin,
  Phone,
  School,
  UserRound,
  Users,
  Wallet,
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
import { PaymentMethodLogo } from "@/components/ui/payment-method-logo";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { DEFAULT_NATIONALITY, NATIONALITY_SUGGESTIONS } from "@/lib/student-form";
import { useLanguage } from "@/lib/i18n/language-provider";
import { studentSchema, type StudentFormValues } from "./schema";
import {
  createStudent,
  updateStudent,
  findDuplicateStudents,
  type DuplicateStudent,
} from "./actions";
import { FormSection } from "@/components/forms/form-section";
import { FormField, IconInput } from "@/components/forms/form-field";
import { PhotoAvatarPicker } from "./student-form/photo-avatar-picker";
import { STATUS_KEYS, STUDENT_STATUSES } from "./students-list/student-status";

export interface StudentClassOption {
  id: string;
  name: string;
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
}: StudentFormDialogProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const isEdit = Boolean(editTarget);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: newStudentValues(),
  });

  const [duplicates, setDuplicates] = useState<DuplicateStudent[]>([]);
  const [duplicateAck, setDuplicateAck] = useState(false);

  useEffect(() => {
    if (open) {
      setDuplicates([]);
      setDuplicateAck(false);
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
  }, [open, editTarget, reset]);

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

      if (isEdit && editTarget) {
        await updateStudent(editTarget.id, values);
        toast.success(t("students.updatedSuccess"));
      } else {
        const result = await createStudent(values);
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
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    }
  }

  const classId = watch("classId");
  const gender = watch("gender");
  const status = watch("status");
  const photoUrl = watch("photoUrl") ?? null;
  const enrollmentAmount = watch("enrollmentAmount");
  const enrollmentMethod = watch("enrollmentMethod");
  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col overflow-y-hidden p-0">
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
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
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
              <FormSection
                icon={Wallet}
                title={t("students.enrollmentFeeSection")}
                hint={t("common.optional")}
              >
                <FormField
                  label={t("students.enrollmentAmount")}
                  htmlFor="enrollmentAmount"
                  error={errors.enrollmentAmount?.message}
                >
                  <Input
                    id="enrollmentAmount"
                    type="number"
                    min={0}
                    placeholder="0"
                    {...register("enrollmentAmount")}
                  />
                </FormField>
                <FormField
                  label={t("students.enrollmentMethod")}
                  htmlFor="student-enrollment-method-select"
                >
                  <Select
                    value={enrollmentMethod || undefined}
                    onValueChange={(v) =>
                      setValue("enrollmentMethod", v as StudentFormValues["enrollmentMethod"])
                    }
                    disabled={!enrollmentAmount}
                  >
                    <SelectTrigger id="student-enrollment-method-select">
                      <SelectValue placeholder={t("students.selectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <span className="flex items-center gap-2">
                            <PaymentMethodLogo method={value} />
                            {label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </FormSection>
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
            <Button type="submit" disabled={isSubmitting} className="sm:min-w-36">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
