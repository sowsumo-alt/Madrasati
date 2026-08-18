import { formatMRU, formatDate } from "@/lib/format";
import {
  SUBSCRIPTION_STATUS_LABELS,
  isOwingStatus,
  PLANS,
  PLAN_LABELS,
  PLAN_PRICE,
  type SubscriptionStatus,
} from "@/lib/plans";

/** Rappel des trois formules et de leurs prix, joint aux messages de fin d'essai. */
function planListing(): string {
  return PLANS.map((p) => `• ${PLAN_LABELS[p]} : ${PLAN_PRICE[p].label}`).join("\n");
}

export interface ReminderContext {
  schoolName: string;
  directorName: string | null;
  status: SubscriptionStatus;
  amountDue: number | null;
  /** Jours de retard sur l'échéance, 0 ou null si l'école est à jour. */
  daysLate: number | null;
  nextDueAt: string | null;
  /** Fin de la période d'essai — seulement renseigné pour un compte en essai. */
  trialEndsAt: string | null;
  /** Jours restants avant la fin de l'essai (négatif si l'essai est dépassé). */
  trialDaysLeft: number | null;
}

/**
 * Message WhatsApp adressé au directeur d'une école cliente, depuis le
 * tableau de bord Super Admin. Le ton change selon le statut de facturation :
 * un rappel de règlement n'a rien à voir avec une prise de nouvelles en
 * période d'essai, et envoyer le mauvais des deux se remarque tout de suite.
 *
 * Rédigé en français uniquement : contrairement aux messages parents (voir
 * withArabic dans src/lib/whatsapp.ts), l'interlocuteur est ici un directeur
 * d'établissement, déjà francophone puisque c'est la langue dans laquelle il
 * administre l'application.
 */
export function buildReminderMessage(ctx: ReminderContext): string {
  const greeting = ctx.directorName ? `Bonjour ${ctx.directorName},` : "Bonjour,";
  const amount = ctx.amountDue != null ? formatMRU(ctx.amountDue) : null;
  const signature = "Bien à vous,\nMadrasati";

  switch (ctx.status) {
    case "pending":
      return [
        greeting,
        "",
        `Merci d'avoir inscrit ${ctx.schoolName} sur Madrasati — j'ai bien reçu votre demande.`,
        "",
        "J'active votre compte et je reviens vers vous très vite. Dès l'activation, vous vous reconnectez et tout votre espace est prêt : vos classes, le programme mauritanien et les modèles de messages sont déjà en place.",
        "",
        signature,
      ].join("\n");

    case "trial":
      return [greeting, "", trialBody(ctx), "", signature].join("\n");

    case "past_due":
    case "restricted":
    case "suspended":
      return [greeting, "", overdueBody(ctx, amount), "", signature].join("\n");

    case "active":
      return [
        greeting,
        "",
        `J'espère que tout se passe bien avec Madrasati pour ${ctx.schoolName}.`,
        "",
        ctx.nextDueAt
          ? `Pour information, votre prochaine échéance est fixée au ${formatDate(ctx.nextDueAt)}.`
          : "Je reste à votre disposition pour toute question ou besoin d'accompagnement.",
        "",
        signature,
      ].join("\n");
  }
}

function trialBody(ctx: ReminderContext): string {
  const intro = `J'espère que la prise en main de Madrasati se passe bien pour ${ctx.schoolName}.`;

  if (ctx.trialDaysLeft == null || ctx.trialEndsAt == null) {
    return `${intro}\n\nDites-moi si vous souhaitez activer votre abonnement, je m'occupe de tout.`;
  }

  // Essai terminé : le message porte le rappel complet des formules, c'est le
  // moment où le directeur doit choisir.
  if (ctx.trialDaysLeft < 0) {
    return (
      `${intro}\n\n` +
      `Votre essai gratuit s'est terminé le ${formatDate(ctx.trialEndsAt)}. ` +
      `Vos données sont bien conservées — rien n'a été supprimé — mais les fonctionnalités avancées sont en pause en attendant votre choix.\n\n` +
      `Voici les trois formules :\n${planListing()}\n\n` +
      `Dites-moi celle qui vous convient et je réactive tout immédiatement.`
    );
  }

  const when =
    ctx.trialDaysLeft === 0
      ? "se termine aujourd'hui"
      : ctx.trialDaysLeft === 1
        ? "se termine demain"
        : `se termine le ${formatDate(ctx.trialEndsAt)}, dans ${ctx.trialDaysLeft} jours`;

  return (
    `${intro}\n\n` +
    `Votre essai gratuit ${when}. Pour continuer sans interruption, il suffit de choisir votre formule :\n${planListing()}\n\n` +
    `Dites-moi laquelle vous convient et je m'occupe de l'activation. Je reste disponible pour toute question.`
  );
}

function overdueBody(ctx: ReminderContext, amount: string | null): string {
  const delay =
    ctx.daysLate && ctx.daysLate > 0
      ? ctx.nextDueAt
        ? `L'échéance du ${formatDate(ctx.nextDueAt)} est dépassée depuis ${ctx.daysLate} jour${ctx.daysLate > 1 ? "s" : ""}`
        : `Le règlement est en retard de ${ctx.daysLate} jour${ctx.daysLate > 1 ? "s" : ""}`
      : "Le règlement de votre abonnement est en attente";

  const amountPart = amount ? `, pour un montant de ${amount}` : "";

  const consequence =
    ctx.status === "suspended"
      ? "\n\nL'accès à l'application est actuellement suspendu ; il est rétabli dès réception du règlement."
      : ctx.status === "restricted"
        ? "\n\nLes fonctionnalités avancées sont temporairement limitées ; tout revient à la normale dès réception du règlement."
        : "";

  return (
    `Un petit rappel concernant l'abonnement Madrasati de ${ctx.schoolName} : ${delay.charAt(0).toLowerCase()}${delay.slice(1)}${amountPart}.` +
    consequence +
    `\n\nDès réception, je réactive tout immédiatement. N'hésitez pas à me dire si vous rencontrez une difficulté, nous trouverons une solution.`
  );
}

/** Libellé du bouton, pour que le Super Admin sache quel ton part avant de cliquer. */
export function reminderButtonTitle(status: SubscriptionStatus): string {
  if (isOwingStatus(status)) return "Envoyer un rappel de paiement sur WhatsApp";
  if (status === "pending") return "Confirmer la prise en compte de l'inscription sur WhatsApp";
  if (status === "trial") return "Envoyer un message de suivi d'essai sur WhatsApp";
  if (status === "active") return "Prendre des nouvelles sur WhatsApp";
  return `Contacter sur WhatsApp (${SUBSCRIPTION_STATUS_LABELS[status]})`;
}
