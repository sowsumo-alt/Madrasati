"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { PdfButton } from "@/components/ui/pdf-button";
import { PrintButton } from "@/components/ui/print-button";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { MissingGrade } from "@/lib/report-card-checks";
import { cn } from "@/lib/utils";

/** « Composition de Mathématiques non saisie », « Devoirs de SVT : élève absent ». */
export function MissingList({ missing }: { missing: MissingGrade[] }) {
  const { t } = useLanguage();
  return (
    <ul className="mt-1 list-disc space-y-0.5 ps-5" data-testid="missing-list">
      {missing.map((m, i) => (
        <li key={i}>
          {t(m.absent ? "bulletin.missingAbsent" : "bulletin.missingItem")
            .replace("{part}", m.part)
            .replace("{subject}", m.subject)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Boutons « Envoyer le PDF » et « Imprimer » d'un bulletin, avec la
 * vérification des notes manquantes : tant qu'il en manque, un bandeau les
 * liste, et générer le bulletin demande de choisir entre compléter les notes
 * d'abord ou continuer en connaissance de cause.
 */
export function ReportCardActions({
  studentName,
  missing,
  notesHref,
  elementId,
  fileName,
  parentPhone,
  message,
  onUse,
}: {
  studentName: string;
  missing: MissingGrade[];
  notesHref: string;
  elementId: string;
  fileName: string;
  parentPhone: string | null;
  message: string;
  onUse: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const answer = useRef<((go: boolean) => void) | null>(null);

  // Demande confirmation, et répond à l'appelant (PDF ou impression).
  function confirmIfMissing(): Promise<boolean> {
    if (missing.length === 0) return Promise.resolve(true);
    setOpen(true);
    return new Promise((resolve) => {
      answer.current = resolve;
    });
  }

  function decide(go: boolean) {
    setOpen(false);
    answer.current?.(go);
    answer.current = null;
  }

  return (
    <>
      {missing.length > 0 && (
        <div
          className="no-print mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="missing-warning"
        >
          <div className="min-w-0">
            <p className="font-semibold">
              {t("bulletin.missingTitle").replace("{name}", studentName)}
            </p>
            <MissingList missing={missing} />
            <Link href={notesHref} className="mt-2 inline-block font-semibold underline">
              {t("bulletin.completeGrades")}
            </Link>
          </div>
        </div>
      )}

      <div className="no-print mb-6 flex flex-wrap justify-end gap-2">
        <PdfButton
          elementId={elementId}
          fileName={fileName}
          labelKey="bulletin.sendPdf"
          parentPhone={parentPhone}
          message={message}
          onUse={onUse}
          beforeUse={confirmIfMissing}
        />
        <PrintButton label={t("bulletin.print")} onUse={onUse} beforeUse={confirmIfMissing} />
      </div>

      <Dialog open={open} onOpenChange={(value) => !value && decide(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bulletin.missingTitle").replace("{name}", studentName)}</DialogTitle>
            <DialogDescription>{t("bulletin.missingConfirm")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto text-sm text-foreground/80">
            <MissingList missing={missing} />
          </div>
          <DialogFooter className="gap-2">
            <Link
              href={notesHref}
              onClick={() => decide(false)}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              {t("bulletin.completeGrades")}
            </Link>
            <Button onClick={() => decide(true)} data-testid="generate-anyway">
              {t("bulletin.generateAnyway")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
