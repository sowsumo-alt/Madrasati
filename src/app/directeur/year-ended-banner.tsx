"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, Loader2, ArrowRight } from "lucide-react";
import { createNextAcademicYear } from "./parametres/actions";

/**
 * Avertit le directeur que l'année scolaire active est terminée, et lui permet
 * d'ouvrir la suivante sans quitter son tableau de bord.
 *
 * Sans ce rappel, l'école continue de saisir présences, notes et frais sur une
 * année révolue — et personne ne s'en aperçoit avant la première incohérence
 * de bulletin.
 */
export function YearEndedBanner({
  label,
  endedOn,
}: {
  label: string;
  endedOn: string;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [done, setDone] = useState<{ label: string; classCount: number } | null>(null);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const result = await createNextAcademicYear();
      setDone(result);
      toast.success(
        `Année ${result.label} ouverte — ${result.classCount} classe(s) reprises.`,
        { duration: 8000 },
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setIsCreating(false);
    }
  }

  if (done) {
    return (
      <div className="animate-page-in rounded-xl border border-primary-200 bg-primary-50 px-5 py-4 text-sm shadow-sm">
        <p className="font-medium text-primary-900">
          Année {done.label} ouverte, avec {done.classCount} classe(s) reprises.
        </p>
        <p className="mt-1 text-primary-800/80">
          Dernière étape : réinscrivez vos élèves dans leurs nouvelles classes.
        </p>
        <Link
          href="/directeur/reinscription"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-800"
        >
          Aller à la Réinscription
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-page-in rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <CalendarClock className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">
            L&apos;année scolaire {label} est terminée (depuis le {endedOn}).
          </p>
          <p className="mt-1 text-xs text-amber-800/80">
            Ouvrez la nouvelle année pour continuer : vos classes actuelles y
            seront reprises avec leurs matières et leurs professeurs, puis vous
            réinscrirez vos élèves. Rien n&apos;est supprimé.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
            >
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CalendarClock className="h-3.5 w-3.5" />
              )}
              Ouvrir la nouvelle année scolaire
            </button>
            <Link
              href="/directeur/parametres"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
            >
              Gérer les années moi-même
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
