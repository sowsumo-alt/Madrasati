"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, Loader2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SessionStatusBadge } from "@/components/timesheet/status-badge";
import { cn } from "@/lib/utils";
import {
  CORRECTABLE_STATUSES,
  STATUS_LABELS,
  dmy,
  hm,
  type CorrectableStatus,
  type SessionStatus,
} from "@/lib/timesheet";
import { correctSession, sessionHistory } from "./actions";

export interface BoardSession {
  id: string;
  startsAt: string;
  endsAt: string;
  className: string;
  subjectName: string;
  status: SessionStatus;
  lateMinutes: number;
  checkedInAt: string | null;
  distance: number | null;
  observation: string | null;
  teacherId: string;
  teacherName: string;
  replacementId: string | null;
  replacementName: string | null;
  corrected: boolean;
}

const SUMMARY: [SessionStatus, string][] = [
  ["PRESENT", "bg-emerald-50 text-emerald-800 border-emerald-200"],
  ["LATE", "bg-amber-50 text-amber-900 border-amber-200"],
  ["ABSENT", "bg-red-50 text-red-800 border-red-200"],
  ["EXCUSED", "bg-blue-50 text-blue-800 border-blue-200"],
  ["REPLACED", "bg-violet-50 text-violet-800 border-violet-200"],
  ["PENDING", "bg-slate-50 text-slate-700 border-slate-200"],
];

/** Rafraîchit la page toutes les 2 min, seulement aujourd'hui et quand elle est à l'écran. */
function useLiveRefresh(enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 120_000);
    return () => clearInterval(timer);
  }, [enabled, router]);
}

export function DayBoard({
  day,
  isToday,
  isFuture,
  sessions,
  teachers,
  readOnly,
}: {
  day: string;
  isToday: boolean;
  isFuture: boolean;
  sessions: BoardSession[];
  teachers: { id: string; name: string }[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<BoardSession | null>(null);
  useLiveRefresh(isToday);
  const counts = useMemo(() => {
    const c = Object.fromEntries(SUMMARY.map(([s]) => [s, 0])) as Record<SessionStatus, number>;
    for (const s of sessions) c[s.status]++;
    return c;
  }, [sessions]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground/70">Jour</span>
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && router.push(`/directeur/pointage?jour=${e.target.value}`)}
            className="h-10 rounded-lg border border-border bg-surface px-3"
            data-testid="timesheet-day"
          />
        </label>
        <Button variant="secondary" onClick={() => router.refresh()}>
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
        <div className="ms-auto flex flex-wrap gap-2" data-testid="timesheet-counts">
          {SUMMARY.map(([status, tone]) => (
            <span key={status} className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold", tone)} data-count={status}>
              {STATUS_LABELS[status]} : {counts[status]}
            </span>
          ))}
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/60">
          {isFuture
            ? "Les séances d'un jour à venir apparaissent le jour même, d'après l'emploi du temps."
            : "Aucune séance ce jour-là (jour non travaillé, ou aucun cours avec enseignant dans l'emploi du temps)."}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-soft" data-testid="board-sessions">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm" data-testid="board-session" data-status={s.status}>
              <div className="w-24 shrink-0 font-semibold tabular-nums text-foreground">
                {hm(new Date(s.startsAt))}–{hm(new Date(s.endsAt))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{s.teacherName}</p>
                <p className="text-foreground/70">
                  {s.className} · {s.subjectName}
                </p>
                {(s.checkedInAt || s.observation) && (
                  <p className="text-xs text-foreground/60">
                    {s.checkedInAt && `Pointé à ${hm(new Date(s.checkedInAt))}${s.distance != null ? ` · à ${s.distance} m de l'école` : ""}`}
                    {s.checkedInAt && s.observation && " · "}
                    {s.observation}
                  </p>
                )}
              </div>
              <SessionStatusBadge status={s.status} lateMinutes={s.lateMinutes} replacement={s.replacementName} />
              {s.corrected && (
                <span className="text-xs text-foreground/50" title="Statut corrigé par la direction">
                  corrigé
                </span>
              )}
              {!readOnly && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(s)} data-testid="board-correct">
                  <Pencil className="h-3.5 w-3.5" />
                  Corriger
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CorrectionDialog
          session={editing}
          teachers={teachers.filter((t) => t.id !== editing.teacherId)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

interface Change {
  id: string;
  userName: string;
  fromStatus: string;
  toStatus: string;
  toReplacement: string | null;
  observation: string | null;
  createdAt: string;
}

const statusLabel = (s: string) => STATUS_LABELS[s as SessionStatus] ?? s;

function CorrectionDialog({
  session,
  teachers,
  onClose,
  onSaved,
}: {
  session: BoardSession;
  teachers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial: CorrectableStatus = session.status === "PENDING" ? "PRESENT" : (session.status as CorrectableStatus);
  const [status, setStatus] = useState<CorrectableStatus>(initial);
  const [lateMinutes, setLateMinutes] = useState(String(session.lateMinutes || ""));
  const [replacementId, setReplacementId] = useState(session.replacementId ?? "");
  const [observation, setObservation] = useState(session.observation ?? "");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Change[] | null>(null);

  useEffect(() => {
    sessionHistory(session.id)
      .then((r) => setHistory(r.ok ? r.changes : []))
      .catch(() => setHistory([]));
  }, [session.id]);

  async function save() {
    setSaving(true);
    try {
      const result = await correctSession(session.id, {
        status,
        lateMinutes: status === "LATE" ? Number(lateMinutes) || undefined : undefined,
        replacementTeacherId: status === "REPLACED" ? replacementId : "",
        observation,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Séance corrigée. L'enseignant est prévenu.");
      onSaved();
    } catch {
      toast.error("La correction n'a pas abouti. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="correction-dialog">
        <DialogHeader>
          <DialogTitle>Corriger la séance</DialogTitle>
          <DialogDescription>
            {session.teacherName} · {session.className} · {session.subjectName} · {dmy(new Date(session.startsAt))}{" "}
            {hm(new Date(session.startsAt))}–{hm(new Date(session.endsAt))}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <legend className="mb-1.5 font-medium text-foreground/70">Statut</legend>
            {CORRECTABLE_STATUSES.map((s) => (
              <label
                key={s}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2",
                  status === s ? "border-primary-600 bg-primary-50" : "border-border",
                )}
              >
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} data-testid={`status-${s}`} />
                {STATUS_LABELS[s]}
              </label>
            ))}
          </fieldset>
          {status === "LATE" && (
            <label className="block space-y-1">
              <span className="font-medium text-foreground/70">Minutes de retard</span>
              <input
                type="number"
                min={1}
                value={lateMinutes}
                onChange={(e) => setLateMinutes(e.target.value)}
                className="h-10 w-32 rounded-lg border border-border bg-surface px-3"
                data-testid="correction-late"
              />
            </label>
          )}
          {status === "REPLACED" && (
            <label className="block space-y-1">
              <span className="font-medium text-foreground/70">Remplacé par (les heures lui reviennent)</span>
              <select
                value={replacementId}
                onChange={(e) => setReplacementId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3"
                data-testid="correction-replacement"
              >
                <option value="">Choisir l&apos;enseignant…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block space-y-1">
            <span className="font-medium text-foreground/70">Observation</span>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              maxLength={300}
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              placeholder="Ex. : certificat médical reçu"
              data-testid="correction-observation"
            />
          </label>
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground/70">
              <History className="h-4 w-4" />
              Historique
            </p>
            {history === null ? (
              <p className="text-foreground/50">Chargement…</p>
            ) : history.length === 0 ? (
              <p className="text-foreground/50">Aucune correction pour l&apos;instant.</p>
            ) : (
              <ul className="space-y-1 text-xs text-foreground/70" data-testid="correction-history">
                {history.map((c) => (
                  <li key={c.id}>
                    {dmy(new Date(c.createdAt))} {hm(new Date(c.createdAt))} · {c.userName} : {statusLabel(c.fromStatus)} →{" "}
                    {statusLabel(c.toStatus)}
                    {c.toReplacement && ` (${c.toReplacement})`}
                    {c.observation && ` — ${c.observation}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving} data-testid="correction-save">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
