"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionStatusBadge } from "@/components/timesheet/status-badge";
import { checkIn } from "@/app/enseignant/pointage/actions";
import { checkInWindow, effectiveStatus, hm, isCheckInOpen, type SessionStatus } from "@/lib/timesheet";

export interface TodaySession {
  id: string;
  startsAt: string;
  endsAt: string;
  className: string;
  subjectName: string;
  status: SessionStatus;
  lateMinutes: number;
  checkedInAt: string | null;
}

/** La position du téléphone, ou un message clair si elle est refusée. */
function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Ce téléphone ne donne pas sa position : pointage impossible ici."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      reject(
        new Error(
          error.code === error.PERMISSION_DENIED
            ? "Autorisez la localisation pour Madrasati (réglages du navigateur), puis réessayez."
            : "Position introuvable : activez la localisation du téléphone et réessayez.",
        ),
      );
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  });
}

/**
 * Séances du jour de l'enseignant, avec le bouton « Je suis en classe »,
 * actif de 10 min avant à 15 min après le début. L'heure affichée suit celle
 * du serveur (décalage mesuré au chargement) ; le serveur revérifie tout.
 */
export function CheckInCard({ sessions, serverNow }: { sessions: TodaySession[]; serverNow: string }) {
  const router = useRouter();
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(serverNow));
  const [busy, setBusy] = useState<string | null>(null);
  // Pointage réussi : affiché tout de suite, sans attendre que la page se recharge (3G).
  const [done, setDone] = useState<Record<string, Pick<TodaySession, "status" | "lateMinutes" | "checkedInAt">>>({});

  // Horloge locale (aucun appel au serveur) : le bouton s'active et se ferme à l'heure.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date(Date.now() + offset)), 15_000);
    return () => clearInterval(timer);
  }, [offset]);

  async function pointer(session: TodaySession) {
    setBusy(session.id);
    try {
      const position = await currentPosition();
      const result = await checkIn(session.id, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      if (!result.ok) {
        toast.error(result.error, { duration: 8000 });
        return;
      }
      setDone((d) => ({ ...d, [session.id]: { status: result.status, lateMinutes: result.lateMinutes, checkedInAt: result.at } }));
      toast.success(
        result.status === "LATE"
          ? `Pointé à ${hm(new Date(result.at))} — retard de ${result.lateMinutes} min.`
          : `Pointé à ${hm(new Date(result.at))}. Bon cours !`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Le pointage n'a pas abouti. Réessayez.", { duration: 8000 });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5" data-testid="check-in-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Mes séances d&apos;aujourd&apos;hui</h2>
        <span className="text-sm tabular-nums text-foreground/60">{hm(now)}</span>
      </div>
      {sessions.length === 0 ? (
        <p className="py-4 text-center text-sm text-foreground/60">Aucune séance prévue aujourd&apos;hui.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((given) => {
            const s = { ...given, ...done[given.id] };
            const startsAt = new Date(s.startsAt);
            const status = effectiveStatus({ status: s.status, endsAt: new Date(s.endsAt) }, now);
            const { opensAt, closesAt } = checkInWindow(startsAt);
            const open = status === "PENDING" && isCheckInOpen(startsAt, now);
            return (
              <li key={s.id} className="rounded-xl border border-border p-3" data-testid="today-session" data-session-id={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tabular-nums text-foreground">
                      {hm(startsAt)} – {hm(new Date(s.endsAt))}
                    </p>
                    <p className="truncate text-sm text-foreground/70">
                      {s.className} · {s.subjectName}
                    </p>
                  </div>
                  <SessionStatusBadge status={status} lateMinutes={s.lateMinutes} />
                </div>
                {status === "PENDING" && (
                  <div className="mt-3">
                    <Button
                      className="h-14 w-full text-base"
                      disabled={!open || busy !== null}
                      onClick={() => pointer(s)}
                      data-testid="check-in-button"
                    >
                      {busy === s.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
                      Je suis en classe
                    </Button>
                    <p className="mt-1.5 text-center text-xs text-foreground/60">
                      {open
                        ? `Ouvert jusqu'à ${hm(closesAt)} · depuis l'école seulement`
                        : now < opensAt
                          ? `Le pointage ouvre à ${hm(opensAt)}`
                          : `Pointage fermé depuis ${hm(closesAt)}`}
                    </p>
                  </div>
                )}
                {(status === "PRESENT" || status === "LATE") && s.checkedInAt && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Pointé à {hm(new Date(s.checkedInAt))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
