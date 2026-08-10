import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getTeacherScope } from "@/lib/teacher-scope";
import { PrintButton } from "@/components/ui/print-button";

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
];

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default async function TeacherSchedulePage() {
  const user = await requireRole(ROLES.TEACHER);
  const scope = await getTeacherScope(user.id, user.schoolId);

  const [slots, school] = await Promise.all([
    scope
      ? prisma.scheduleSlot.findMany({
          // Seulement les créneaux que cet enseignant assure réellement.
          where: { classSubject: { teacherId: scope.teacher.id } },
          orderBy: { startMinutes: "asc" },
          include: {
            classRoom: { select: { name: true } },
            classSubject: { include: { subject: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mon emploi du temps</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Vos cours de la semaine, du lundi au vendredi.
          </p>
        </div>
        <PrintButton label="Imprimer" />
      </div>

      <p className="hidden text-center text-lg font-semibold text-foreground print:block">
        {school?.name} — Emploi du temps —{" "}
        {scope ? `${scope.teacher.firstName} ${scope.teacher.lastName}` : ""}
      </p>

      {slots.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
          Aucun cours ne vous est encore assigné dans l&apos;emploi du temps.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DAYS.map((day) => {
            const daySlots = slots.filter((s) => s.dayOfWeek === day.value);
            return (
              <div key={day.value} className="rounded-xl border border-border bg-surface p-3">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  {day.label}
                </p>
                {daySlots.length === 0 ? (
                  <p className="py-6 text-center text-xs text-foreground/30">—</p>
                ) : (
                  <div className="space-y-2">
                    {daySlots.map((s) => (
                      <div key={s.id} className="rounded-lg bg-primary-50 px-2.5 py-2">
                        <p className="text-xs font-medium text-primary-800">
                          {minutesToTime(s.startMinutes)} – {minutesToTime(s.endMinutes)}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {s.classSubject.subject.name}
                        </p>
                        <p className="text-xs text-foreground/60">{s.classRoom.name}</p>
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
    </div>
  );
}
