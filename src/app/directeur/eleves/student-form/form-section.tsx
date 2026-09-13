import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Bloc titré du formulaire élève (identité, scolarité, parents, frais), avec
 * son bandeau vert pâle comme sur la maquette. Deux colonnes dès que la
 * largeur le permet, une seule sur téléphone.
 */
export function FormSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** Précision discrète à côté du titre, ex. « optionnel ». */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-primary-100 bg-surface">
      <div className="flex items-center gap-2.5 border-b border-primary-100 bg-primary-50/70 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-primary-600 shadow-sm">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <h3 className="text-sm font-semibold text-primary-900">{title}</h3>
        {hint && <span className="text-xs text-foreground/45">({hint})</span>}
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
