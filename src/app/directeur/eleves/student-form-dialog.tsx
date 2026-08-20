"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ui/image-picker";
import { studentSchema, type StudentFormValues } from "./schema";
import {
  createStudent,
  updateStudent,
  findDuplicateStudents,
  type DuplicateStudent,
} from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";

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
  photoUrl?: string | null;
  parentFirstName?: string;
  parentLastName?: string;
  parentPhone?: string;
}

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: StudentClassOption[];
  editTarget?: StudentEditTarget | null;
}

const emptyValues: StudentFormValues = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  classId: "",
  status: "ACTIVE",
  photoUrl: null,
  parentFirstName: "",
  parentLastName: "",
  parentPhone: "",
};

export function StudentFormDialog({
  open,
  onOpenChange,
  classes,
  editTarget,
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
    defaultValues: emptyValues,
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
              gender: (editTarget.gender as "M" | "F" | "") ?? "",
              classId: editTarget.classId ?? "",
              status: editTarget.status as StudentFormValues["status"],
              photoUrl: editTarget.photoUrl ?? null,
              parentFirstName: editTarget.parentFirstName ?? "",
              parentLastName: editTarget.parentLastName ?? "",
              parentPhone: editTarget.parentPhone ?? "",
            }
          : emptyValues,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("students.edit") : t("students.new")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>
              {t("students.photo")}{" "}
              <span className="font-normal text-foreground/40">
                ({t("common.optional")})
              </span>
            </Label>
            <ImagePicker
              value={photoUrl}
              onChange={(v) => setValue("photoUrl", v, { shouldDirty: true })}
              maxSize={240}
              shape="circle"
              label={t("students.choosePhoto")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">{t("students.firstName")}</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName && (
                <p className="text-xs text-danger">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">{t("students.lastName")}</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-xs text-danger">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth">{t("students.dateOfBirth")}</Label>
              <DateInput id="dateOfBirth" {...register("dateOfBirth")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="student-gender-select">{t("students.gender")}</Label>
              <Select
                value={gender || undefined}
                onValueChange={(v) => setValue("gender", v as "M" | "F")}
              >
                <SelectTrigger id="student-gender-select">
                  <SelectValue placeholder={t("students.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">{t("students.gender.M")}</SelectItem>
                  <SelectItem value="F">{t("students.gender.F")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="student-class-select">{t("students.class")}</Label>
              {/* Plus d'option « Sans classe » : elle était le choix par défaut,
                  et un élève enregistré ainsi disparaissait des appels et des
                  bulletins sans que rien ne l'indique au directeur. */}
              <Select
                value={classId || undefined}
                onValueChange={(v) => setValue("classId", v, { shouldValidate: true })}
                disabled={classes.length === 0}
              >
                <SelectTrigger id="student-class-select">
                  <SelectValue placeholder={t("students.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classes.length === 0 ? (
                <p className="text-xs text-danger">{t("students.createClassFirst")}</p>
              ) : (
                errors.classId && (
                  <p className="text-xs text-danger">{errors.classId.message}</p>
                )
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="student-status-select">{t("students.status")}</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setValue("status", v as StudentFormValues["status"])
                }
              >
                <SelectTrigger id="student-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{t("students.status.ACTIVE")}</SelectItem>
                  <SelectItem value="INACTIVE">{t("students.status.INACTIVE")}</SelectItem>
                  <SelectItem value="TRANSFERRED">
                    {t("students.status.TRANSFERRED")}
                  </SelectItem>
                  <SelectItem value="GRADUATED">{t("students.status.GRADUATED")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-foreground/80">
              {t("students.parentSection")}{" "}
              <span className="font-normal text-foreground/40">
                ({t("common.optional")})
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="parentFirstName">{t("students.firstName")}</Label>
                <Input id="parentFirstName" {...register("parentFirstName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parentLastName">{t("students.lastName")}</Label>
                <Input id="parentLastName" {...register("parentLastName")} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="parentPhone">{t("students.parentPhone")}</Label>
              <Input
                id="parentPhone"
                placeholder="+222 XX XX XX XX"
                {...register("parentPhone")}
              />
            </div>
          </div>

          {!isEdit && (
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium text-foreground/80">
                {t("students.enrollmentFeeSection")}{" "}
                <span className="font-normal text-foreground/40">
                  ({t("common.optional")})
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="enrollmentAmount">{t("students.enrollmentAmount")}</Label>
                  <Input
                    id="enrollmentAmount"
                    type="number"
                    min={0}
                    placeholder="0"
                    {...register("enrollmentAmount")}
                  />
                  {errors.enrollmentAmount && (
                    <p className="text-xs text-danger">{errors.enrollmentAmount.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-enrollment-method-select">
                    {t("students.enrollmentMethod")}
                  </Label>
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
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                      {d.className ? ` — ${d.className}` : " — sans classe"}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-amber-800/80">{t("students.duplicateHint")}</p>
                <button
                  type="button"
                  onClick={() => setDuplicateAck(true)}
                  className="mt-2 rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
                >{t("students.duplicateConfirm")}</button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
