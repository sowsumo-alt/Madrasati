import Link from "next/link";
import { BellRing, CheckCircle2, Settings, Users, Wallet } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { describeDueRule } from "@/lib/due-rule";
import { formatMoney } from "@/lib/money";
import { formatDate, formatPhone } from "@/lib/format";
import { loadReminderGroups } from "@/lib/payment-reminder-data";
import { reminderMessage, reminderPhone, reminderWhatsAppUrl } from "@/lib/payment-reminder";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RemindersView, type ReminderRow } from "./reminders-view";

/**
 * Rappels du mois : chaque famille qui a un mois dû non réglé, avec le
 * montant exact, les mois concernés et un bouton WhatsApp au message déjà
 * écrit. « Rappel envoyé le … » évite de relancer deux fois.
 */
export default async function RemindersPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const now = new Date();
  const { groups, rule, schoolName, unit } = await loadReminderGroups(user.schoolId, now);
  const sent = await prisma.paymentReminder.findMany({
    where: { schoolId: user.schoolId, groupKey: { in: groups.map((g) => g.key) } },
    orderBy: { sentAt: "desc" },
    select: { groupKey: true, sentAt: true, userName: true, amount: true },
  });
  const lastSent = new Map<string, (typeof sent)[number]>();
  for (const r of sent) if (!lastSent.has(r.groupKey)) lastSent.set(r.groupKey, r);

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows: ReminderRow[] = groups.map((g) => {
    const message = reminderMessage(g, { schoolName, unit });
    const last = lastSent.get(g.key);
    const studentId = g.key.startsWith("student:") ? g.key.slice("student:".length) : null;
    return {
      key: g.key,
      name: g.parentName ?? g.children[0]?.name ?? "Élève",
      href: g.parentId ? `/directeur/familles/${g.parentId}` : studentId ? `/directeur/eleves?q=${encodeURIComponent(g.children[0]?.name ?? "")}` : null,
      phone: g.phone ? formatPhone(reminderPhone(g.phone)) : null,
      whatsappUrl: g.phone ? reminderWhatsAppUrl(g.phone, message) : null,
      children: g.children.map((c) => ({ name: c.name, className: c.className })),
      lines: g.lines.map((l) => ({ label: l.label, amount: formatMoney(l.amount, unit) })),
      total: formatMoney(g.total, unit),
      // Le lendemain du jour limite + tolérance : le premier jour d'impayé.
      since: formatDate(new Date(g.oldestDue.getTime() + 1)),
      message,
      lastSent: last
        ? {
            at: last.sentAt.toISOString(),
            by: last.userName,
            amount: last.amount === g.total ? null : formatMoney(last.amount, unit),
          }
        : null,
    };
  });

  const remindedThisMonth = rows.filter((r) => r.lastSent && new Date(r.lastSent.at) >= monthStart).length;
  const total = groups.reduce((sum, g) => sum + g.total, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="reminders">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <BellRing className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Rappels du mois</h1>
            <p className="text-sm text-foreground/60">Les familles qui ont un mois dû non réglé, avec le montant exact à rappeler.</p>
          </div>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-2.5 text-sm text-primary-900" data-testid="reminders-rule">
        <span>{describeDueRule(rule, now)} Un mois payé d&apos;avance n&apos;apparaît jamais ici.</span>
        <Link href="/directeur/parametres" className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
          <Settings className="h-3.5 w-3.5" />
          Changer le jour limite
        </Link>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Familles à relancer" value={String(rows.length - remindedThisMonth)} icon={Users} tone="amber" hint={`${rows.length} famille(s) avec un mois dû`} />
        <KpiCard label="Déjà relancées ce mois" value={String(remindedThisMonth)} icon={CheckCircle2} tone="emerald" hint="rappel WhatsApp envoyé" />
        <KpiCard label="Montant dû à rappeler" value={formatMoney(total, unit)} icon={Wallet} tone="rose" hint="mois échus non réglés" />
      </div>

      <RemindersView rows={rows} monthStart={monthStart.toISOString()} readOnly={user.readOnly} />
    </div>
  );
}
