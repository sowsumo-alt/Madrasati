import { Hourglass, MessageCircle } from "lucide-react";
import { TRIAL_REMINDER_DAYS } from "@/lib/plans";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { buildReminderMessage } from "../reminder-message";
import type { SchoolRow } from "./types";

/**
 * Essais à relancer : l'application n'envoie aucun message toute seule, donc
 * cette liste est le rappel — les écoles dont l'essai se termine bientôt, ou
 * vient de se terminer, avec le message WhatsApp déjà rédigé à envoyer.
 */
export function TrialsAlert({ schools }: { schools: SchoolRow[] }) {
  const ending = schools
    .filter((s) => s.subscriptionStatus === "trial" && s.trialDaysLeft != null && s.trialDaysLeft <= TRIAL_REMINDER_DAYS)
    .sort((a, b) => (a.trialDaysLeft ?? 0) - (b.trialDaysLeft ?? 0));
  if (ending.length === 0) return null;

  return (
    <section id="essais" className="scroll-mt-20 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-500/10" data-testid="sa-trials">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        <Hourglass className="h-4 w-4" />
        {ending.length} essai{ending.length > 1 ? "s" : ""} à relancer
      </p>
      <p className="mt-1 text-xs text-amber-900/70 dark:text-amber-200/60">
        Madrasati n&apos;envoie pas de message tout seul : cliquez pour ouvrir la conversation, le texte est déjà rédigé
        avec les formules et leurs prix.
      </p>
      <ul className="mt-3 space-y-1.5">
        {ending.map((s) => {
          const left = s.trialDaysLeft ?? 0;
          const when =
            left > 1 ? `dans ${left} jours` : left === 1 ? "demain" : left === 0 ? "aujourd'hui" : `terminé depuis ${-left} jour${-left > 1 ? "s" : ""}`;
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface/70 px-3 py-2">
              <span className="min-w-0 truncate text-sm text-foreground">
                {s.name}
                <span className="ms-2 text-xs text-amber-800 dark:text-amber-200/70">{when}</span>
              </span>
              {s.directorPhone ? (
                <a
                  href={buildWhatsAppUrl(
                    s.directorPhone,
                    buildReminderMessage({
                      schoolName: s.name,
                      directorName: s.directorName,
                      status: s.subscriptionStatus,
                      amountDue: s.amountDue,
                      daysLate: s.daysLate,
                      nextDueAt: s.nextDueAt,
                      trialEndsAt: s.trialEndsAt,
                      trialDaysLeft: s.trialDaysLeft,
                    }),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Relancer
                </a>
              ) : (
                <span className="shrink-0 text-xs text-foreground/40">Pas de numéro</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
