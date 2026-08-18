"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintButton } from "@/components/ui/print-button";
import { SlotFormDialog, type SlotSubjectOption } from "./slot-form-dialog";
import { deleteSlot } from "./actions";
import { minutesToTime } from "./schema";

export interface ScheduleClassOption {
  id: string;
  name: string;
  classSubjects: SlotSubjectOption[];
}

export interface SlotRow {
  id: string;
  classId: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  room: string | null;
  subjectName: string;
  teacherName: string | null;
}

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
];

export function ScheduleView({
  classes,
  slots,
  schoolName,
}: {
  classes: ScheduleClassOption[];
  slots: SlotRow[];
  schoolName: string;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [formOpen, setFormOpen] = useState(false);

  const selectedClass = classes.find((c) => c.id === classId) ?? null;
  const classSlots = useMemo(
    () =>
      slots
        .filter((s) => s.classId === classId)
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [slots, classId],
  );

  /**
   * Classes dont la semaine est entièrement vide. Le directeur ne consulte
   * qu'une classe à la fois : sans ce récapitulatif, une classe oubliée ne se
   * découvre que le jour de la rentrée.
   */
  const emptyClasses = useMemo(
    () => classes.filter((c) => !slots.some((s) => s.classId === c.id)),
    [classes, slots],
  );

  async function handleDelete(slotId: string) {
    try {
      await deleteSlot(slotId);
      toast.success("Créneau retiré.");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Emploi du temps</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Organisez la semaine de chaque classe, du lundi au vendredi.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <PrintButton label="Imprimer" />
          <Button onClick={() => setFormOpen(true)} disabled={!selectedClass}>
            <Plus className="h-4 w-4" />
            Nouveau créneau
          </Button>
        </div>
      </div>

      {emptyClasses.length > 0 && (
        <div className="no-print flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">
              {emptyClasses.length} classe{emptyClasses.length > 1 ? "s" : ""} sans
              aucun cours programmé
            </p>
            <p className="mt-1 text-xs text-amber-800/80">
              Aucun créneau de toute la semaine pour :{" "}
              {emptyClasses.map((c) => c.name).join(", ")}.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {emptyClasses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClassId(c.id)}
                  className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200"
                >
                  Remplir {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="no-print max-w-xs">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger>
            <SelectValue placeholder="Choisir une classe" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClass && (
        <p className="hidden text-center text-lg font-semibold text-foreground print:block">
          {schoolName} — Emploi du temps — {selectedClass.name}
        </p>
      )}

      {!selectedClass ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
          Créez d&apos;abord une classe dans le module Classes.
        </div>
      ) : selectedClass.classSubjects.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
          Assignez d&apos;abord des matières et des enseignants à cette classe
          depuis le module Classes.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DAYS.map((day) => {
            const daySlots = classSlots.filter((s) => s.dayOfWeek === day.value);
            return (
              <div
                key={day.value}
                className="rounded-xl border border-border bg-surface p-3"
              >
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  {day.label}
                </p>
                {daySlots.length === 0 ? (
                  <p className="py-6 text-center text-xs text-foreground/30">—</p>
                ) : (
                  <div className="space-y-2">
                    {daySlots.map((s) => (
                      <div
                        key={s.id}
                        className="group relative rounded-lg bg-primary-50 px-2.5 py-2"
                      >
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="no-print absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full text-primary-700 hover:bg-primary-100 group-hover:flex"
                          title="Retirer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <p className="text-xs font-medium text-primary-800">
                          {minutesToTime(s.startMinutes)} – {minutesToTime(s.endMinutes)}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {s.subjectName}
                        </p>
                        {s.teacherName && (
                          <p className="text-xs text-foreground/60">{s.teacherName}</p>
                        )}
                        {s.room && (
                          <p className="text-xs text-foreground/40">Salle {s.room}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedClass && (
        <SlotFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          classId={selectedClass.id}
          classSubjects={selectedClass.classSubjects}
        />
      )}
    </div>
  );
}
