import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Grand panneau blanc translucide d'une section (Classes, Matières) : pastille
 * d'icône, titre, sous-titre et boutons d'action en en-tête.
 */
export function SectionPanel({
  icon: Icon,
  title,
  subtitle,
  actions,
  titleAs: Title = "h2",
  className,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  titleAs?: "h1" | "h2";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-white/80 bg-surface/85 p-4 shadow-[0_10px_40px_-18px_rgba(7,54,34,0.25)] backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/80 text-primary-800 shadow-sm">
            <Icon className="h-7 w-7" fill="currentColor" strokeWidth={1.25} />
          </span>
          <div className="min-w-0">
            <Title className="text-2xl font-bold tracking-tight text-primary-900">{title}</Title>
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Boutons d'en-tête de section : même hauteur, coins plus ronds que le
 *  bouton standard, l'action principale en vert profond. */
export const sectionButton = {
  primary:
    "h-11 rounded-xl bg-gradient-to-b from-primary-700 to-primary-800 px-5 text-sm font-semibold text-white shadow-md shadow-primary-900/20 hover:from-primary-800 hover:to-primary-900",
  secondary:
    "h-11 rounded-xl border border-border/60 bg-surface px-5 text-sm font-semibold text-primary-800 shadow-sm hover:bg-primary-50/60",
};
