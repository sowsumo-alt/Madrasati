"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMRU } from "@/lib/format";
import { sameName } from "@/lib/removal-name";
import { cn } from "@/lib/utils";
import { removalPreview, removeAction, type RemovalPreview } from "./removal-actions";

type Mode = "ARCHIVE" | "DELETE";

/**
 * Supprimer ou archiver un élève ou une famille, en deux étapes : choisir
 * (archiver est recommandé dès qu'il y a des paiements), puis recopier le nom.
 */
export function RemovalDialog({
  kind,
  id,
  open,
  onOpenChange,
  onDone,
}: {
  kind: "student" | "family";
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Après la suppression ou l'archivage. */
  onDone: (mode: Mode) => void;
}) {
  const [preview, setPreview] = useState<RemovalPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("ARCHIVE");
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTyped("");
    setPreview(null);
    setError(null);
    removalPreview(kind, id)
      .then((r) => {
        if (!r.ok) return setError(r.error);
        setPreview(r);
        // Sans argent en jeu, la suppression est le choix attendu.
        setMode(r.payments > 0 ? "ARCHIVE" : "DELETE");
      })
      .catch(() => setError("Impossible de charger les informations. Réessayez."));
  }, [open, kind, id]);

  async function confirm() {
    if (!preview) return;
    setSaving(true);
    try {
      const r = await removeAction({ kind, id, mode, confirmName: typed });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        mode === "ARCHIVE"
          ? `${preview.name} archivé${kind === "family" ? "e" : ""} : l'historique et les paiements sont conservés.`
          : `${preview.name} supprimé${kind === "family" ? "e" : ""} définitivement.`,
      );
      onOpenChange(false);
      onDone(mode);
    } catch {
      toast.error("L'opération n'a pas abouti. Rien n'a été modifié : réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const what = kind === "family" ? "cette famille" : "cet élève";
  const options: { value: Mode; title: string; hint: string; icon: typeof Archive }[] = [
    {
      value: "ARCHIVE",
      title: `Archiver${preview && preview.payments > 0 ? " (recommandé)" : ""}`,
      hint:
        kind === "family"
          ? "Les enfants passent « Retiré ». Paiements, reçus et historique restent consultables."
          : "L'élève passe « Retiré ». Paiements, reçus et historique restent consultables.",
      icon: Archive,
    },
    {
      value: "DELETE",
      title: `Supprimer définitivement${preview && preview.payments > 0 ? " (données de test)" : ""}`,
      hint:
        kind === "family"
          ? "La famille, ses enfants, leurs échéances, paiements et reçus disparaissent. Irréversible."
          : "L'élève, ses échéances, paiements, reçus, notes et présences disparaissent. Irréversible.",
      icon: Trash2,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md" data-testid="removal-dialog">
        <DialogHeader>
          <DialogTitle>
            {kind === "family" ? "Supprimer ou archiver la famille" : "Supprimer ou archiver l'élève"}
          </DialogTitle>
          <DialogDescription>
            {preview
              ? `${preview.name}${kind === "family" ? ` · ${preview.children} enfant(s)` : ""} · ${
                  preview.payments > 0
                    ? `${preview.payments} paiement(s), ${formatMRU(preview.paidTotal)} encaissés`
                    : "aucun paiement"
                }`
              : error ?? "Chargement…"}
          </DialogDescription>
        </DialogHeader>

        {preview && step === 1 && (
          <div className="space-y-2" role="radiogroup">
            {options.map(({ value, title, hint, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors",
                  mode === value
                    ? value === "DELETE"
                      ? "border-red-400 bg-red-50 ring-1 ring-red-400"
                      : "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                    : "border-border hover:bg-surface-muted",
                )}
                data-testid={`removal-${value}`}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", value === "DELETE" ? "text-red-600" : "text-primary-700")} />
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-foreground/60">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {preview && step === 2 && (
          <label className="block space-y-1.5 text-sm">
            <span>
              Pour confirmer, recopiez <b>{preview.name}</b> :
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3"
              data-testid="removal-name"
            />
          </label>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => (step === 2 ? setStep(1) : onOpenChange(false))} disabled={saving}>
            {step === 2 ? "Retour" : "Annuler"}
          </Button>
          {step === 1 ? (
            <Button type="button" onClick={() => setStep(2)} disabled={!preview} data-testid="removal-next">
              Continuer
            </Button>
          ) : (
            <Button
              type="button"
              onClick={confirm}
              disabled={saving || !preview || !sameName(typed, preview.name)}
              className={mode === "DELETE" ? "bg-red-700 hover:bg-red-800" : undefined}
              data-testid="removal-confirm"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "ARCHIVE" ? `Archiver ${what}` : `Supprimer ${what} définitivement`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
