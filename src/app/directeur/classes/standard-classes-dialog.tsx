"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SCHOOL_TYPES,
  SCHOOL_TYPE_LABELS,
  SCHOOL_TYPE_HINTS,
  standardClassesFor,
  type SchoolType,
} from "@/lib/school-levels";
import { generateStandardClasses } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Crée les classes standard en un clic, pour une école qui n'en a pas encore.
 * Les écoles inscrites aujourd'hui les reçoivent dès la création (voir
 * createSchoolWithDirector) : ce dialogue sert aux écoles plus anciennes et à
 * celles qui ajoutent un cycle en cours d'année.
 */
export function StandardClassesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [schoolType, setSchoolType] = useState<SchoolType>("complet");
  const [isCreating, setIsCreating] = useState(false);

  const preview = standardClassesFor(schoolType);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const { created } = await generateStandardClasses(schoolType);
      if (created === 0) {
        toast.info(t("classes.autoAlreadyExist"));
      } else {
        toast.success(`${created} classe(s) créée(s) avec leurs matières.`);
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("classes.autoTitle")}</DialogTitle>
          <DialogDescription>{t("classes.autoHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {SCHOOL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSchoolType(type)}
                aria-pressed={schoolType === type}
                className={cn(
                  "rounded-lg border px-2 py-3 text-center transition-colors",
                  schoolType === type
                    ? "border-primary-500 bg-primary-50 text-primary-800 ring-1 ring-primary-500"
                    : "border-border text-foreground/70 hover:border-primary-300 hover:bg-surface-muted",
                )}
              >
                <span className="block text-xs font-medium leading-tight">
                  {SCHOOL_TYPE_LABELS[type]}
                </span>
                <span className="mt-0.5 block text-[11px] text-foreground/45">
                  {SCHOOL_TYPE_HINTS[type]}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-surface-muted px-3 py-3">
            <p className="text-xs font-medium text-foreground/60">
              {preview.length} classes seront créées
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {preview.map((c) => (
                <span
                  key={c.name}
                  className="rounded-md bg-surface px-2 py-1 text-xs text-foreground/70"
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-foreground/50">{t("classes.autoNoDuplicate")}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Créer les classes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
