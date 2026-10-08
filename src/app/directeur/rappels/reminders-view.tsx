"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Clock, MessageCircle, PhoneOff, Search } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { recordReminder } from "./actions";

export interface ReminderRow {
  key: string;
  /** Le parent, ou l'élève quand aucun parent n'est enregistré. */
  name: string;
  href: string | null;
  phone: string | null;
  whatsappUrl: string | null;
  children: { name: string; className: string | null }[];
  lines: { label: string; amount: string }[];
  total: string;
  /** Premier jour d'impayé du plus ancien mois dû. */
  since: string;
  message: string;
  /** Dernier rappel ; `amount` seulement s'il différait du montant dû d'aujourd'hui. */
  lastSent: { at: string; by: string; amount: string | null } | null;
}

type Tab = "todo" | "done" | "all";

export function RemindersView({ rows, monthStart, readOnly }: { rows: ReminderRow[]; monthStart: string; readOnly: boolean }) {
  // Rappels notés pendant la visite : la ligne bascule sans attendre le rechargement.
  const [justSent, setJustSent] = useState<Record<string, { at: string; by: string }>>({});
  const [tab, setTab] = useState<Tab>("todo");
  const [query, setQuery] = useState("");
  const [openMessage, setOpenMessage] = useState<string | null>(null);

  const lastOf = (row: ReminderRow) => justSent[row.key] ?? row.lastSent;
  const sentThisMonth = (row: ReminderRow) => {
    const last = lastOf(row);
    return Boolean(last && last.at >= monthStart);
  };

  const counts = {
    todo: rows.filter((r) => !sentThisMonth(r)).length,
    done: rows.filter((r) => sentThisMonth(r)).length,
    all: rows.length,
  };

  const visible = useMemo(() => {
    const words = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (tab === "todo" && sentThisMonth(r)) return false;
      if (tab === "done" && !sentThisMonth(r)) return false;
      const haystack = [r.name, r.phone ?? "", ...r.children.map((c) => `${c.name} ${c.className ?? ""}`)]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      return words.every((w) => haystack.includes(w));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, query, justSent]);

  async function markSent(row: ReminderRow) {
    // Affiché dès le clic ; l'heure et le nom exacts arrivent avec la réponse.
    const previous = justSent[row.key];
    setJustSent((prev) => ({ ...prev, [row.key]: { at: new Date().toISOString(), by: "vous" } }));
    const result = await recordReminder(row.key);
    if (result.ok) {
      setJustSent((prev) => ({ ...prev, [row.key]: { at: result.sentAt, by: result.userName } }));
      toast.success(`Rappel noté : ${row.name}, ${formatDate(result.sentAt)} à ${formatTime(result.sentAt)}.`);
    } else {
      setJustSent((prev) => {
        const next = { ...prev };
        if (previous) next[row.key] = previous;
        else delete next[row.key];
        return next;
      });
      toast.error(result.error);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-soft" data-testid="reminders-empty">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="font-semibold text-foreground">Aucun rappel à envoyer</p>
        <p className="text-sm text-foreground/60">Aucune famille n&apos;a de mois dû non réglé aujourd&apos;hui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-surface p-1 text-sm">
          {(
            [
              ["todo", "À relancer"],
              ["done", "Déjà relancées ce mois"],
              ["all", "Toutes"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors",
                tab === value ? "bg-primary-700 text-white" : "text-foreground/70 hover:bg-surface-muted",
              )}
              data-testid={`reminders-tab-${value}`}
            >
              {label} <span className="opacity-70">({counts[value]})</span>
            </button>
          ))}
        </div>
        <label className="relative ms-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Parent, élève, classe…"
            className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-foreground/60">
          {tab === "todo" ? "Toutes les familles ont déjà reçu leur rappel ce mois-ci." : "Aucune famille ici."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => {
            const last = lastOf(row);
            const done = sentThisMonth(row);
            return (
              <li
                key={row.key}
                className={cn("rounded-2xl border bg-surface p-4 shadow-soft", done ? "border-emerald-200" : "border-border")}
                data-testid="reminder-row"
                data-sent={done ? "yes" : "no"}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {row.href ? (
                        <Link href={row.href} className="font-semibold text-foreground hover:text-primary-700 hover:underline">
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-foreground">{row.name}</span>
                      )}
                      {row.phone && (
                        <span className="text-sm text-foreground/60" dir="ltr">
                          {row.phone}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/70">
                      {row.children.map((c) => (c.className ? `${c.name} (${c.className})` : c.name)).join(", ")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.lines.map((l) => (
                        <span key={l.label} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-800" data-testid="reminder-line">
                          {l.label} · {l.amount}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-lg font-bold text-rose-700" data-testid="reminder-total">
                      {row.total}
                    </p>
                    <p className="text-xs text-foreground/50">impayé depuis le {row.since}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {last ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                        done ? "bg-emerald-50 text-emerald-800" : "bg-surface-muted text-foreground/70",
                      )}
                      data-testid="reminder-sent"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Rappel envoyé le {formatDate(last.at)} à {formatTime(last.at)} par {last.by}
                      {"amount" in last && last.amount ? ` — ${last.amount} à ce moment-là` : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                      <Clock className="h-3.5 w-3.5" />
                      Aucun rappel envoyé
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenMessage(openMessage === row.key ? null : row.key)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                    aria-expanded={openMessage === row.key}
                    data-testid="reminder-preview"
                  >
                    Voir le message
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", openMessage === row.key && "rotate-180")} />
                  </button>
                  <div className="ms-auto">
                    {!row.whatsappUrl ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground/60">
                        <PhoneOff className="h-3.5 w-3.5" />
                        Aucun numéro WhatsApp
                        {row.href && (
                          <Link href={row.href} className="font-semibold text-primary-700 hover:underline">
                            Ajouter
                          </Link>
                        )}
                      </span>
                    ) : readOnly ? (
                      <span className="text-xs text-foreground/50">Lecture seule</span>
                    ) : (
                      <a
                        href={row.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void markSent(row)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                          done
                            ? "border border-emerald-600 bg-surface text-emerald-700 hover:bg-emerald-50"
                            : "bg-emerald-600 text-white hover:bg-emerald-700",
                        )}
                        data-testid="reminder-whatsapp"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {done ? "Renvoyer" : "Envoyer sur WhatsApp"}
                      </a>
                    )}
                  </div>
                </div>
                {openMessage === row.key && (
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 font-sans text-xs text-foreground/80" data-testid="reminder-message">
                    {row.message}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
