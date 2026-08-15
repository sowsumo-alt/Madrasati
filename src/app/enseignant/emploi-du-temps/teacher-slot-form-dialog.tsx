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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teacherSlotSchema, type TeacherSlotFormValues } from "./schema";
import { createTeacherSlot } from "./actions";

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
];

export interface TeacherClassSubjectOption {
  id: string;
  subjectName: string;
  className: string;
}

interface TeacherSlotFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classSubjects: TeacherClassSubjectOption[];
}

export function TeacherSlotFormDialog({
  open,
  onOpenChange,
  classSubjects,
}: TeacherSlotFormDialogProps) {
  const router = useRouter();
  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    register,
    formState: { errors, isSubmitting },
  } = useForm<TeacherSlotFormValues>({
    resolver: zodResolver(teacherSlotSchema),
    defaultValues: {
      classSubjectId: "",
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:00",
      room: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        classSubjectId: "",
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "09:00",
        room: "",
      });
    }
  }, [open, reset]);

  async function onSubmit(values: TeacherSlotFormValues) {
    try {
      await createTeacherSlot(values);
      toast.success("Cours ajouté à votre emploi du temps.");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  const dayOfWeek = watch("dayOfWeek");
  const classSubjectId = watch("classSubjectId");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un cours</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="teacher-slot-class-subject-select">Classe & matière</Label>
            <Select
              value={classSubjectId || undefined}
              onValueChange={(v) => setValue("classSubjectId", v)}
            >
              <SelectTrigger id="teacher-slot-class-subject-select">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {classSubjects.map((cs) => (
                  <SelectItem key={cs.id} value={cs.id}>
                    {cs.className} — {cs.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.classSubjectId && (
              <p className="text-xs text-danger">{errors.classSubjectId.message}</p>
            )}
            {classSubjects.length === 0 && (
              <p className="text-xs text-foreground/50">
                Aucune matière ne vous est encore assignée. Contactez le directeur.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="teacher-slot-day-select">Jour</Label>
            <Select
              value={String(dayOfWeek)}
              onValueChange={(v) => setValue("dayOfWeek", Number(v))}
            >
              <SelectTrigger id="teacher-slot-day-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Début</Label>
              <Input id="startTime" type="time" {...register("startTime")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">Fin</Label>
              <Input id="endTime" type="time" {...register("endTime")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="room">
              Salle <span className="font-normal text-foreground/40">(optionnel)</span>
            </Label>
            <Input id="room" {...register("room")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || classSubjects.length === 0}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
