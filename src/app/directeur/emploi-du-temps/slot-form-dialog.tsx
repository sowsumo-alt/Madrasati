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
import { slotSchema, type SlotFormValues } from "./schema";
import { createSlot } from "./actions";

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
];

export interface SlotSubjectOption {
  id: string;
  subjectName: string;
  teacherName: string | null;
}

interface SlotFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  classSubjects: SlotSubjectOption[];
}

export function SlotFormDialog({
  open,
  onOpenChange,
  classId,
  classSubjects,
}: SlotFormDialogProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      classId,
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
        classId,
        classSubjectId: "",
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "09:00",
        room: "",
      });
    }
  }, [open, classId, reset]);

  async function onSubmit(values: SlotFormValues) {
    try {
      await createSlot(values);
      toast.success("Créneau ajouté à l'emploi du temps.");
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
          <DialogTitle>Nouveau créneau</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="slot-subject-teacher-select">Matière & enseignant</Label>
            <Select
              value={classSubjectId || undefined}
              onValueChange={(v) => setValue("classSubjectId", v)}
            >
              <SelectTrigger id="slot-subject-teacher-select">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {classSubjects.map((cs) => (
                  <SelectItem key={cs.id} value={cs.id}>
                    {cs.subjectName}
                    {cs.teacherName ? ` — ${cs.teacherName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.classSubjectId && (
              <p className="text-xs text-danger">{errors.classSubjectId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slot-day-select">Jour</Label>
            <Select
              value={String(dayOfWeek)}
              onValueChange={(v) => setValue("dayOfWeek", Number(v))}
            >
              <SelectTrigger id="slot-day-select">
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
