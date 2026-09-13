"use client";

import { X } from "lucide-react";
import { subjectStyle } from "@/components/subjects/subject-style";
import { cn } from "@/lib/utils";

/**
 * Carte d'un cours dans la grille : icône et couleur de la matière, enseignant
 * et salle. La classe n'apparaît que lorsque plusieurs classes sont affichées
 * ensemble (emploi du temps d'un enseignant).
 */
export function CourseCard({
  subjectName,
  teacherName,
  room,
  className,
  roomLabel,
  removeLabel,
  onRemove,
}: {
  subjectName: string;
  teacherName: string | null;
  room: string | null;
  className?: string;
  roomLabel: string;
  removeLabel: string;
  onRemove?: () => void;
}) {
  const style = subjectStyle(subjectName);
  const Icon = style.icon;
  // « Salle 201 » plutôt que « Salle Salle 201 » quand la salle a été saisie
  // avec son intitulé.
  const roomText = room && (/salle|gymnase|labo|terrain/i.test(room) ? room : `${roomLabel} ${room}`);

  return (
    <div className={cn("group relative flex items-start gap-2.5 rounded-xl border p-2.5", style.card)}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", style.badge)}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 text-xs leading-snug">
        <p className="font-semibold text-foreground">{subjectName}</p>
        {className && <p className="font-medium text-primary-700">{className}</p>}
        {teacherName && <p className="truncate text-foreground/60">{teacherName}</p>}
        {roomText && <p className="truncate text-foreground/45">{roomText}</p>}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={removeLabel}
          aria-label={removeLabel}
          className="no-print absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface/90 text-foreground/50 opacity-0 shadow-sm transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
