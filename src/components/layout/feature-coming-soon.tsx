import Link from "next/link";
import { ArrowLeft, Sparkles, type LucideIcon } from "lucide-react";

/**
 * Page d'une fonctionnalité annoncée dans le menu mais pas encore développée.
 * Elle s'affiche dans l'application, menu et en-tête compris, à la différence
 * de ComingSoon qui remplace tout l'écran.
 */
export function FeatureComingSoon({
  icon: Icon,
  title,
  badge,
  description,
  backLabel,
  backHref = "/directeur",
}: {
  icon: LucideIcon;
  title: string;
  badge: string;
  description: string;
  backLabel: string;
  backHref?: string;
}) {
  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-surface px-6 py-10 text-center shadow-soft">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Icon className="h-8 w-8" strokeWidth={1.75} />
        </span>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
          <Sparkles className="h-3.5 w-3.5" />
          {badge}
        </span>
        <h1 className="mt-3 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-foreground/60">{description}</p>
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
