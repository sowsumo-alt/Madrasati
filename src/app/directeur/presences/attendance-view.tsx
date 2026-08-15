"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCheck, Clock, Loader2, X } from "lucide-react";
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
import { StatTile } from "@/components/ui/stat-tile";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { cn } from "@/lib/utils";
import { formatLongDate } from "@/lib/format";
import { fillTemplate, withArabic } from "@/lib/whatsapp";
import { saveAttendance } from "./actions";

export interface AttendanceClassOption {
  id: string;
  name: string;
}

export interface AttendanceStudent {
  id: string;
  firstName: string;
  lastName: string;
  attendanceRate: number;
  parent: { firstName: string; lastName: string; phone: string } | null;
}

const STATUSES = [
  { value: "PRESENT", label: "Présent", icon: Check },
  { value: "ABSENT", label: "Absent", icon: X },
  { value: "LATE", label: "Retard", icon: Clock },
] as const;

export function AttendanceView({
  classes,
  students,
  existingRecords,
  selectedClassId,
  selectedDate,
  schoolName,
  absenceTemplate,
  absenceTemplateAr,
  basePath = "/directeur/presences",
}: {
  classes: AttendanceClassOption[];
  students: AttendanceStudent[];
  existingRecords: Record<string, string>;
  selectedClassId: string;
  selectedDate: string;
  schoolName: string;
  absenceTemplate: string;
  absenceTemplateAr?: string;
  /** Permet de réutiliser cette vue dans l'espace enseignant. */
  basePath?: string;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, string>>(existingRecords);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setMarks(existingRecords);
  }, [existingRecords]);

  function updateFilters(classId: string, date: string) {
    router.push(`${basePath}?classId=${classId}&date=${date}`);
  }

  function markAll(status: string) {
    const next: Record<string, string> = {};
    for (const s of students) next[s.id] = status;
    setMarks(next);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const entries = Object.entries(marks).map(([studentId, status]) => ({
        studentId,
        status,
      }));
      await saveAttendance(selectedClassId, selectedDate, entries);
      toast.success("Appel enregistré.");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 650);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  }

  const presentCount = students.filter((s) => marks[s.id] === "PRESENT").length;
  const absentStudents = students.filter((s) => marks[s.id] === "ABSENT");
  const lateCount = students.filter((s) => marks[s.id] === "LATE").length;

  const formattedDate = formatLongDate(`${selectedDate}T00:00:00`);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Présences</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Faites l&apos;appel et alertez les parents des élèves absents.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5 sm:w-56">
          <Label htmlFor="attendance-class-select">Classe</Label>
          <Select
            value={selectedClassId}
            onValueChange={(v) => updateFilters(v, selectedDate)}
          >
            <SelectTrigger id="attendance-class-select">
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
        <div className="space-y-1.5 sm:w-48">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => updateFilters(selectedClassId, e.target.value)}
          />
        </div>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
          {classes.length === 0
            ? "Créez d'abord une classe."
            : "Aucun élève actif dans cette classe."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="Présents" value={String(presentCount)} icon={Check} tone="primary" />
            <StatTile label="Absents" value={String(absentStudents.length)} icon={X} tone="warning" />
            <StatTile label="Retards" value={String(lateCount)} icon={Clock} tone="neutral" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => markAll("PRESENT")}>
              <CheckCheck className="h-4 w-4" />
              Tous présents
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(justSaved && "animate-ring-pulse")}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer l&apos;appel
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                    <th className="px-5 py-3">Élève</th>
                    <th className="px-5 py-3">Taux de présence</th>
                    <th className="px-5 py-3">Statut du jour</th>
                    <th className="px-5 py-3 text-right">Parent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((s) => {
                    const current = marks[s.id];
                    const message = s.parent
                      ? withArabic(
                          fillTemplate(absenceTemplate, {
                            parentName: `${s.parent.firstName} ${s.parent.lastName}`,
                            studentName: `${s.firstName} ${s.lastName}`,
                            date: formattedDate,
                            schoolName,
                          }),
                          absenceTemplateAr &&
                            fillTemplate(absenceTemplateAr, {
                              parentName: `${s.parent.firstName} ${s.parent.lastName}`,
                              studentName: `${s.firstName} ${s.lastName}`,
                              date: formattedDate,
                              schoolName,
                            }),
                        )
                      : "";
                    return (
                      <tr key={s.id} className="hover:bg-surface-muted/40">
                        <td className="px-5 py-3 font-medium text-foreground">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="px-5 py-3 text-foreground/70">
                          {s.attendanceRate}%
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1">
                            {STATUSES.map((st) => {
                              const Icon = st.icon;
                              const active = current === st.value;
                              return (
                                <button
                                  key={st.value}
                                  onClick={() =>
                                    setMarks((m) => ({ ...m, [s.id]: st.value }))
                                  }
                                  className={cn(
                                    "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                                    active
                                      ? st.value === "PRESENT"
                                        ? "bg-primary-700 text-white"
                                        : st.value === "ABSENT"
                                          ? "bg-danger text-white"
                                          : "bg-accent-500 text-white"
                                      : "bg-surface-muted text-foreground/50 hover:text-foreground",
                                  )}
                                >
                                  <Icon
                                    key={active ? `${s.id}-${st.value}-active` : st.value}
                                    className={cn("h-3.5 w-3.5", active && "animate-check-pop")}
                                  />
                                  {st.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end">
                            {s.parent && current === "ABSENT" ? (
                              <WhatsAppLink
                                phone={s.parent.phone}
                                message={message}
                                title="Alerter le parent sur WhatsApp"
                              />
                            ) : (
                              <span className="text-xs text-foreground/30">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
