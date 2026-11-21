"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LATE_DEDUCTION_LABELS, type LateDeduction } from "@/lib/timesheet";
import { saveTimesheetSettings, setTimesheetEnabled } from "@/app/directeur/pointage/actions";

type Settings = { latitude: number | null; longitude: number | null; radius: number; lateDeduction: LateDeduction };

/**
 * Pointage des enseignants : le directeur active le module pour son école,
 * puis règle la position de l'école (le pointage n'est accepté que dans le
 * rayon) et la règle des retards.
 */
export function TimesheetSettingsCard({ enabled, initial, readOnly }: { enabled: boolean; initial: Settings; readOnly: boolean }) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function toggle(on: boolean) {
    if (!on && !window.confirm("Désactiver le pointage des enseignants ? Rien n'est supprimé : tout revient si vous le réactivez.")) return;
    setSwitching(true);
    try {
      const result = await setTimesheetEnabled(on);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(on ? "Pointage activé. Relevez maintenant la position de l'école." : "Pointage désactivé.");
      router.refresh();
    } catch {
      toast.error("Le changement n'a pas abouti. Réessayez.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Card id="pointage" className="scroll-mt-24" data-testid="timesheet-settings">
      <CardHeader>
        <CardTitle className="text-sm">Pointage des enseignants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 text-sm">
        {enabled ? (
          <TimesheetSettingsForm initial={initial} readOnly={readOnly} switching={switching} onDisable={() => toggle(false)} />
        ) : (
          <>
            <p className="text-foreground/60">
              Remplace la fiche de pointage papier : les enseignants pointent depuis leur téléphone à l&apos;école, les retards et
              absences sont relevés seuls, et la paie à l&apos;heure se calcule chaque mois. Le pointage commence le jour de
              l&apos;activation.
            </p>
            {!readOnly && (
              <Button onClick={() => toggle(true)} disabled={switching} data-testid="ts-enable">
                {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                Activer le pointage
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TimesheetSettingsForm({
  initial,
  readOnly,
  switching,
  onDisable,
}: {
  initial: Settings;
  readOnly: boolean;
  switching: boolean;
  onDisable: () => void;
}) {
  const router = useRouter();
  const [latitude, setLatitude] = useState(initial.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initial.longitude?.toString() ?? "");
  const [radius, setRadius] = useState(String(initial.radius));
  const [lateDeduction, setLateDeduction] = useState<LateDeduction>(initial.lateDeduction);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  function locate() {
    if (!("geolocation" in navigator)) {
      toast.error("Cet appareil ne donne pas sa position.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLatitude(p.coords.latitude.toFixed(6));
        setLongitude(p.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success(`Position relevée (précision ${Math.round(p.coords.accuracy)} m). Enregistrez pour la garder.`);
      },
      () => {
        setLocating(false);
        toast.error("Position introuvable : autorisez la localisation, ou saisissez les coordonnées.");
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveTimesheetSettings({
        latitude: latitude.trim() === "" ? null : Number(latitude.replace(",", ".")),
        longitude: longitude.trim() === "" ? null : Number(longitude.replace(",", ".")),
        radius: Number(radius),
        lateDeduction,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Paramètres du pointage enregistrés.");
      router.refresh();
    } catch {
      toast.error("L'enregistrement n'a pas abouti. Vérifiez les nombres saisis.");
    } finally {
      setSaving(false);
    }
  }

  const field = "h-10 w-full rounded-lg border border-border bg-surface px-3";
  return (
    <>
      <p className="text-foreground/60">
        Les enseignants pointent depuis leur téléphone, seulement à moins de {radius || "…"} m de l&apos;école. Le plus simple :
        relevez la position depuis l&apos;école même.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="font-medium text-foreground/70">Latitude</span>
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} inputMode="decimal" placeholder="18.0866" className={field} disabled={readOnly} data-testid="ts-latitude" />
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-foreground/70">Longitude</span>
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} inputMode="decimal" placeholder="-15.9785" className={field} disabled={readOnly} data-testid="ts-longitude" />
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-foreground/70">Rayon (mètres)</span>
          <input type="number" min={30} max={2000} value={radius} onChange={(e) => setRadius(e.target.value)} className={field} disabled={readOnly} data-testid="ts-radius" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="font-medium text-foreground/70">Retards sur la paie</span>
        <select value={lateDeduction} onChange={(e) => setLateDeduction(e.target.value as LateDeduction)} className={field} disabled={readOnly} data-testid="ts-late">
          {(Object.keys(LATE_DEDUCTION_LABELS) as LateDeduction[]).map((k) => (
            <option key={k} value={k}>
              {LATE_DEDUCTION_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={locate} disabled={locating}>
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            Utiliser ma position actuelle
          </Button>
          <Button onClick={save} disabled={saving} data-testid="ts-save">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
          <Button variant="ghost" onClick={onDisable} disabled={switching} className="ms-auto text-foreground/60" data-testid="ts-disable">
            Désactiver le module
          </Button>
        </div>
      )}
    </>
  );
}
