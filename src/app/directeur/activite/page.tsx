import Link from "next/link";
import { Activity } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatDateIn, formatMRU } from "@/lib/format";
import { ACTIVITY_ACTIONS, ACTIVITY_LABELS, type ActivityAction } from "@/lib/activity";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const ACTION_STYLE: Record<ActivityAction, string> = {
  PAYMENT: "bg-emerald-50 text-emerald-700",
  CANCEL: "bg-red-50 text-red-700",
  DELETE: "bg-red-50 text-red-700",
  ARCHIVE: "bg-amber-50 text-amber-800",
  ENROLL: "bg-primary-50 text-primary-700",
  SHEET: "bg-blue-50 text-blue-700",
  USER: "bg-violet-50 text-violet-700",
};

/**
 * Journal d'activité : qui a fait quoi, et quand — encaissements,
 * annulations, suppressions, inscriptions, comptes. Filtrable par personne
 * et par type d'action.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ qui?: string; type?: string; page?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { qui, type, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const action = type && type in ACTIVITY_ACTIONS ? (type as ActivityAction) : undefined;

  const where: Prisma.ActivityLogWhereInput = {
    schoolId: user.schoolId,
    ...(qui ? { userId: qui } : {}),
    ...(action ? { action } : {}),
  };
  const [entries, total, people] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.groupBy({
      by: ["userId", "userName"],
      where: { schoolId: user.schoolId, userId: { not: null } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const params = new URLSearchParams();
    if (qui) params.set("qui", qui);
    if (action) params.set("type", action);
    if (p > 1) params.set("page", String(p));
    const query = params.toString();
    return `/directeur/activite${query ? `?${query}` : ""}`;
  };
  const persons = [...new Map(people.map((p) => [p.userId!, p.userName])).entries()];

  return (
    <div className="space-y-5" data-testid="activity-view">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Activity className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Journal d&apos;activité</h1>
          <p className="text-sm text-foreground/60">Qui a fait quoi : encaissements, annulations, suppressions, inscriptions, comptes.</p>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3" action="/directeur/activite">
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-foreground/70">Personne</span>
          <select name="qui" defaultValue={qui ?? ""} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm" data-testid="activity-who">
            <option value="">Tout le monde</option>
            {persons.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-foreground/70">Action</span>
          <select name="type" defaultValue={action ?? ""} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm" data-testid="activity-type">
            <option value="">Toutes</option>
            {(Object.keys(ACTIVITY_LABELS) as ActivityAction[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800">
          Filtrer
        </button>
      </form>

      <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-soft">
        {entries.length === 0 && <li className="px-4 py-10 text-center text-sm text-foreground/50">Aucune action enregistrée.</li>}
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-sm" data-testid="activity-row">
            <span className="w-full shrink-0 text-xs text-foreground/55 sm:w-36 sm:pt-0.5">
              {formatDateIn("fr", e.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                ACTION_STYLE[e.action as ActivityAction] ?? "bg-surface-muted text-foreground/70",
              )}
            >
              {ACTIVITY_LABELS[e.action as ActivityAction] ?? e.action}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-foreground">{e.userName}</span>
              <span className="text-foreground/75"> — {e.summary}</span>
              {e.href && (
                <Link href={e.href} className="ms-2 text-xs font-medium text-primary-700 hover:underline">
                  Voir
                </Link>
              )}
            </span>
            {e.amount != null && (
              <span className="shrink-0 font-semibold text-foreground" dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatMRU(e.amount)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={link(page - 1)} className="font-medium text-primary-700 hover:underline">
              ← Plus récentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-foreground/55">
            Page {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={link(page + 1)} className="font-medium text-primary-700 hover:underline">
              Plus anciennes →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
