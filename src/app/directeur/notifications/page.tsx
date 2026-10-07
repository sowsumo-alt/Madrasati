import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Bell,
  CheckCircle2,
  FileWarning,
  Hourglass,
  MessageCircle,
  UserRoundSearch,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatMRU } from "@/lib/format";
import { FEATURES, daysBetween, schoolHasFeature, trialEndsAt } from "@/lib/plans";
import { findAtRiskStudents } from "@/lib/at-risk";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/lib/contact";
import { cn } from "@/lib/utils";

type Tone = "danger" | "warning" | "info" | "success";

interface Notice {
  id: string;
  tone: Tone;
  icon: LucideIcon;
  title: string;
  detail: string;
  href?: string;
  action?: string;
  external?: boolean;
}

const TONES: Record<Tone, { card: string; badge: string }> = {
  danger: { card: "border-red-200 bg-red-50/60", badge: "bg-red-100 text-red-700" },
  warning: { card: "border-amber-200 bg-amber-50/60", badge: "bg-amber-100 text-amber-700" },
  info: { card: "border-border bg-surface", badge: "bg-primary-50 text-primary-700" },
  success: { card: "border-emerald-200 bg-emerald-50/50", badge: "bg-emerald-100 text-emerald-700" },
};

const ORDER: Record<Tone, number> = { danger: 0, warning: 1, info: 2, success: 3 };

/**
 * Notifications du directeur : ce qui demande son attention aujourd'hui,
 * calculé à l'ouverture de la page à partir des données de l'école — rien
 * n'est stocké, donc rien n'est jamais en retard sur la réalité.
 */
export default async function NotificationsPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const schoolId = user.schoolId;
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [school, year, overdue, students, today, cancelledWeek, associates] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, plan: true, subscriptionStatus: true, createdAt: true, nextDueAt: true },
    }),
    prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } }),
    prisma.fee.findMany({
      where: { schoolId, status: { not: "PAID" }, dueDate: { lt: now } },
      select: { amount: true, studentId: true, payments: { select: { amount: true } } },
    }),
    prisma.student.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fees: { select: { academicYearId: true }, take: 50 },
        parentLinks: { select: { parentId: true } },
      },
    }),
    prisma.payment.findMany({
      where: { schoolId, paidAt: { gte: startOfDay } },
      select: { amount: true, receiptNumber: true },
    }),
    prisma.cancelledPayment.findMany({
      where: { schoolId, cancelledAt: { gte: weekAgo } },
      select: { amount: true, receiptNumber: true },
    }),
    user.isOwner
      ? prisma.user.findMany({
          where: { schoolId, role: ROLES.DIRECTOR, isOwner: false, isActive: true, mustChangePassword: true },
          select: { name: true },
        })
      : Promise.resolve([]),
  ]);

  const notices: Notice[] = [];

  // — Impayés : frais échus non soldés.
  const overdueLeft = overdue.reduce((sum, f) => sum + Math.max(f.amount - f.payments.reduce((s, p) => s + p.amount, 0), 0), 0);
  if (overdue.length > 0) {
    notices.push({
      id: "impayes",
      tone: "danger",
      icon: Wallet,
      title: `${overdue.length} frais échu(s) non réglé(s)`,
      detail: `${formatMRU(overdueLeft)} à encaisser, pour ${new Set(overdue.map((f) => f.studentId)).size} élève(s).`,
      href: "/directeur/finance?statut=impayes",
      action: "Voir les impayés",
    });
  }

  // — Abonnement Madrasati de l'école.
  if (school) {
    const status = school.subscriptionStatus;
    const contact = buildWhatsAppUrl(CONTACT_PHONE, `Bonjour, je suis le directeur de ${school.name} et je souhaite régler mon abonnement Madrasati.`);
    if (status === "trial") {
      const left = daysBetween(now, trialEndsAt(school));
      if (left <= 7) {
        notices.push({
          id: "essai",
          tone: left <= 2 ? "danger" : "warning",
          icon: Hourglass,
          title: left > 0 ? `Votre essai se termine dans ${left} jour(s)` : "Votre période d'essai est terminée",
          detail: "Contactez l'assistance Madrasati pour choisir votre formule et garder l'accès.",
          href: contact,
          action: "Contacter l'assistance",
          external: true,
        });
      }
    } else if (status === "past_due" || status === "restricted") {
      notices.push({
        id: "abonnement",
        tone: "danger",
        icon: AlertTriangle,
        title: "Abonnement Madrasati à régler",
        detail: "Le paiement de votre abonnement est en retard. Contactez l'assistance pour éviter une interruption.",
        href: contact,
        action: "Contacter l'assistance",
        external: true,
      });
    }
  }

  // — Élèves sans fiche de paiement cette année (ni la leur, ni celle de leur famille).
  if (year) {
    const withFees = new Set(students.filter((s) => s.fees.some((f) => f.academicYearId === year.id)).map((s) => s.id));
    const familyPlans = await prisma.tuitionPlan.findMany({
      where: { schoolId, academicYearId: year.id, familyParentId: { not: null } },
      select: { familyParentId: true },
    });
    const coveredFamilies = new Set(familyPlans.map((p) => p.familyParentId));
    const missing = students.filter((s) => !withFees.has(s.id) && !s.parentLinks.some((l) => coveredFamilies.has(l.parentId)));
    if (missing.length > 0) {
      const names = missing.slice(0, 4).map((s) => `${s.firstName} ${s.lastName}`.trim());
      notices.push({
        id: "sans-fiche",
        tone: "warning",
        icon: FileWarning,
        title: `${missing.length} élève(s) sans fiche de paiement cette année`,
        detail: `${names.join(", ")}${missing.length > names.length ? "…" : ""} — rien ne leur est facturé tant que leur fiche n'est pas saisie.`,
        href: "/directeur/eleves",
        action: "Ouvrir la liste des élèves",
      });
    }
  }

  // — Élèves à surveiller (selon la formule de l'école).
  if (school && schoolHasFeature(school, FEATURES.AT_RISK_DETECTION)) {
    const atRisk = await findAtRiskStudents(schoolId);
    if (atRisk.length > 0) {
      notices.push({
        id: "a-surveiller",
        tone: "info",
        icon: UserRoundSearch,
        title: `${atRisk.length} élève(s) à surveiller`,
        detail: "Moyenne basse, baisse des notes, absences ou incidents répétés.",
        href: "/directeur/eleves-a-surveiller",
        action: "Voir les élèves",
      });
    }
  }

  // — Équipe : associés qui n'ont pas encore fait leur première connexion.
  if (associates.length > 0) {
    notices.push({
      id: "associes",
      tone: "info",
      icon: UserX,
      title: `${associates.length} associé(s) pas encore connecté(s)`,
      detail: `${associates.map((a) => a.name).join(", ")} — renvoyez-leur leurs identifiants si besoin.`,
      href: "/directeur/utilisateurs",
      action: "Gérer les utilisateurs",
    });
  }

  // — Reçus annulés cette semaine.
  if (cancelledWeek.length > 0) {
    notices.push({
      id: "annulations",
      tone: "info",
      icon: Ban,
      title: `${new Set(cancelledWeek.map((c) => c.receiptNumber.split("-").slice(0, 3).join("-"))).size} reçu(s) annulé(s) cette semaine`,
      detail: `${formatMRU(cancelledWeek.reduce((sum, c) => sum + c.amount, 0))} retirés de l'argent perçu. Qui, quand et pourquoi : le journal d'activité.`,
      href: "/directeur/activite?type=CANCEL",
      action: "Voir le journal",
    });
  }

  // — Encaissé aujourd'hui.
  if (today.length > 0) {
    notices.push({
      id: "aujourdhui",
      tone: "success",
      icon: CheckCircle2,
      title: `${formatMRU(today.reduce((sum, p) => sum + p.amount, 0))} encaissés aujourd'hui`,
      detail: `${new Set(today.map((p) => p.receiptNumber.split("-").slice(0, 3).join("-"))).size} reçu(s) émis depuis ce matin.`,
      href: "/directeur/finance",
      action: "Voir les paiements",
    });
  }

  notices.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-testid="notifications">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Bell className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-foreground/60">Ce qui demande votre attention aujourd&apos;hui.</p>
        </div>
      </div>

      {notices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-soft">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          <p className="font-semibold text-foreground">Tout est en ordre</p>
          <p className="text-sm text-foreground/60">Aucun impayé, aucune fiche en attente, rien à signaler.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notices.map((n) => {
            const t = TONES[n.tone];
            const Icon = n.icon;
            return (
              <li key={n.id} className={cn("flex flex-wrap items-start gap-3 rounded-2xl border p-4 shadow-soft", t.card)} data-testid="notice" data-tone={n.tone}>
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", t.badge)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{n.title}</p>
                  <p className="mt-0.5 text-sm text-foreground/70">{n.detail}</p>
                </div>
                {n.href &&
                  (n.external ? (
                    <a
                      href={n.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 self-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {n.action}
                    </a>
                  ) : (
                    <Link
                      href={n.href}
                      className="inline-flex shrink-0 items-center self-center rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-primary-800 hover:bg-surface-muted"
                    >
                      {n.action}
                    </Link>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
