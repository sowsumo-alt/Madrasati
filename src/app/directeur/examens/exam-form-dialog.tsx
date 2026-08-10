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
import { examSchema, TERMS, type ExamFormValues } from "./schema";
import { createExam } from "./actions";

export interface ExamClassOption {
  id: string;
  name: string;
  subjects: { id: string; name: string }[];
}

interface ExamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ExamClassOption[];
}

const emptyValues: ExamFormValues = {
  classId: "",
  subjectId: "",
  title: "",
  term: "Trimestre 1",
  date: "",
  durationMinutes: "",
  maxScore: 20,
};

export function ExamFormDialog({ open, onOpenChange, classes }: ExamFormDialogProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) reset(emptyValues);
  }, [open, reset]);

  async function onSubmit(values: ExamFormValues) {
    try {
      await createExam(values);
      toast.success("Examen planifié.");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  const classId = watch("classId");
  const subjectId = watch("subjectId");
  const term = watch("term");
  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel examen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select
                value={classId || undefined}
                onValueChange={(v) => {
                  setValue("classId", v);
                  setValue("subjectId", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classId && (
                <p className="text-xs text-danger">{errors.classId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Matière</Label>
              <Select
                value={subjectId || undefined}
                onValueChange={(v) => setValue("subjectId", v)}
                disabled={!selectedClass}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {selectedClass?.subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.subjectId && (
                <p className="text-xs text-danger">{errors.subjectId.message}</p>
              )}
              {selectedClass && selectedClass.subjects.length === 0 && (
                <p className="text-xs text-foreground/50">
                  Assignez d&apos;abord des matières à cette classe.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" placeholder="Devoir surveillé n°1" {...register("title")} />
            {errors.title && (
              <p className="text-xs text-danger">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Trimestre</Label>
              <Select
                value={term}
                onValueChange={(v) => setValue("term", v as ExamFormValues["term"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && (
                <p className="text-xs text-danger">{errors.date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes">
                Durée en minutes{" "}
                <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input id="durationMinutes" type="number" min={0} {...register("durationMinutes")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxScore">Note maximale</Label>
              <Input id="maxScore" type="number" min={1} step="0.5" {...register("maxScore")} />
              {errors.maxScore && (
                <p className="text-xs text-danger">{errors.maxScore.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Planifier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
