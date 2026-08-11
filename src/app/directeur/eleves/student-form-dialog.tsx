"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { createStudent, updateStudent } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

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

  useEffect(() => {
    if (open) {
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
      if (isEdit && editTarget) {
        await updateStudent(editTarget.id, values);
        toast.success(t("students.updatedSuccess"));
      } else {
        await createStudent(values);
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
              <Label>{t("students.gender")}</Label>
              <Select
                value={gender || undefined}
                onValueChange={(v) => setValue("gender", v as "M" | "F")}
              >
                <SelectTrigger>
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
              <Label>{t("students.class")}</Label>
              <Select
                value={classId || "none"}
                onValueChange={(v) => setValue("classId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("students.noClass")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("students.noClass")}</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("students.status")}</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setValue("status", v as StudentFormValues["status"])
                }
              >
                <SelectTrigger>
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
