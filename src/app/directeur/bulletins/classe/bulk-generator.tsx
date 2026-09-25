"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileText, Loader2, Play, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PdfButton } from "@/components/ui/pdf-button";
import { useLanguage } from "@/lib/i18n/language-provider";
import { exportElementsToPdf } from "@/lib/pdf-export";
import type { MissingGrade } from "@/lib/report-card-checks";
import { cn } from "@/lib/utils";
import { markReportCardIssued } from "../actions";
import { MissingList } from "../[studentId]/report-card-actions";

export interface BulkStudent {
  id: string;
  name: string;
  missing: MissingGrade[];
  parentPhone: string | null;
  /** Message WhatsApp déjà rempli pour ce parent. */
  message: string;
  fileName: string;
  /** Le bulletin, rendu côté serveur. */
  document: ReactNode;
}

type Phase = "summary" | "running" | "done";

/**
 * Génération des bulletins de toute une classe : d'abord le résumé (qui est
 * prêt, qui a des notes manquantes), puis la génération élève par élève avec
 * sa progression, enfin la vue groupée — tout imprimer, un seul PDF pour la
 * classe, ou l'envoi à chaque parent par WhatsApp.
 *
 * « Générer » un bulletin, c'est le figer sur la règle de calcul du jour
 * (markReportCardIssued) : c'est ce qui le rend sûr à distribuer.
 */
export function BulkGenerator({
  className,
  term,
  students,
  notesHref,
}: {
  className: string;
  term: string;
  students: BulkStudent[];
  notesHref: string;
}) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("summary");
  const [includeIncomplete, setIncludeIncomplete] = useState(false);
  const [done, setDone] = useState(0);
  const [generated, setGenerated] = useState<string[]>([]);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);

  const ready = students.filter((s) => s.missing.length === 0);
  const incomplete = students.filter((s) => s.missing.length > 0);
  const queue = includeIncomplete ? students : ready;

  async function run() {
    setPhase("running");
    setDone(0);
    const ok: string[] = [];
    for (const student of queue) {
      try {
        await markReportCardIssued(student.id, term);
        ok.push(student.id);
      } catch {
        toast.error(t("bulletin.bulkFailed").replace("{name}", student.name));
      }
      setDone((n) => n + 1);
    }
    setGenerated(ok);
    setPhase("done");
    toast.success(t("bulletin.bulkDone").replace("{n}", String(ok.length)));
  }

  async function downloadAll() {
    const elements = generated
      .map((id) => document.getElementById(`bulletin-${id}`))
      .filter((el): el is HTMLElement => el != null);
    setPdfProgress(`0/${elements.length}`);
    try {
      await exportElementsToPdf(elements, `Bulletins-${className}-${term}.pdf`, (n, total) =>
        setPdfProgress(`${n}/${total}`),
      );
    } catch {
      toast.error(t("pdf.failed"));
    } finally {
      setPdfProgress(null);
    }
  }

  const shown = students.filter((s) => generated.includes(s.id));

  return (
    <div className="space-y-5">
      {phase === "summary" && (
        <section className="no-print space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <p className="text-base font-semibold text-foreground" data-testid="bulk-summary">
            {t("bulletin.bulkSummary")
              .replace("{ready}", String(ready.length))
              .replace("{incomplete}", String(incomplete.length))}
            {incomplete.length > 0 && <> ({incomplete.map((s) => s.name).join(", ")})</>}
          </p>

          {incomplete.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {incomplete.map((s) => (
                <div key={s.id} data-testid="bulk-missing">
                  <p className="font-semibold">
                    {t("bulletin.missingTitle").replace("{name}", s.name)}
                  </p>
                  <MissingList missing={s.missing} />
                </div>
              ))}
              <label className="flex items-start gap-2 border-t border-amber-200 pt-3">
                <input
                  type="checkbox"
                  checked={includeIncomplete}
                  onChange={(e) => setIncludeIncomplete(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400 text-primary-700 focus:ring-primary-500"
                  data-testid="include-incomplete"
                />
                <span>{t("bulletin.bulkIncludeIncomplete")}</span>
              </label>
              <Link href={notesHref} className="inline-block font-semibold underline">
                {t("bulletin.completeGrades")}
              </Link>
            </div>
          )}

          <Button onClick={run} disabled={queue.length === 0} data-testid="bulk-run">
            <Play className="h-4 w-4" />
            {t("bulletin.bulkRun").replace("{n}", String(queue.length))}
          </Button>
        </section>
      )}

      {phase === "running" && (
        <section className="no-print rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground" data-testid="bulk-progress">
            <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
            {t("bulletin.bulkProgress")
              .replace("{done}", String(done))
              .replace("{total}", String(queue.length))}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-primary-600 transition-all"
              style={{ width: `${queue.length ? (done / queue.length) * 100 : 0}%` }}
            />
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="no-print space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <p className="flex items-center gap-2 text-base font-semibold text-primary-800" data-testid="bulk-done">
            <CheckCircle2 className="h-5 w-5" />
            {t("bulletin.bulkDone").replace("{n}", String(generated.length))}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.print()} data-testid="bulk-print">
              <Printer className="h-4 w-4" />
              {t("bulletin.bulkPrint")}
            </Button>
            <Button variant="secondary" onClick={downloadAll} disabled={pdfProgress != null} data-testid="bulk-pdf">
              {pdfProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {pdfProgress
                ? t("bulletin.bulkPdfProgress").replace("{progress}", pdfProgress)
                : t("bulletin.bulkPdf")}
            </Button>
          </div>

          <ul className="divide-y divide-border rounded-xl border border-border" data-testid="bulk-list">
            {shown.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {s.name}
                  {s.missing.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      {t("bulletin.missingCount").replace("{n}", String(s.missing.length))}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <a
                    href={`#bulletin-${s.id}`}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    <FileText className="h-4 w-4" />
                    {t("bulletin.viewReportCard")}
                  </a>
                  {s.parentPhone ? (
                    <PdfButton
                      elementId={`bulletin-${s.id}`}
                      fileName={s.fileName}
                      labelKey="bulletin.sendPdf"
                      parentPhone={s.parentPhone}
                      message={s.message}
                    />
                  ) : (
                    <span className="text-xs text-foreground/45">{t("bulletin.noParentPhone")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Les bulletins générés, un par page à l'impression. */}
      {phase === "done" && (
        <div className="space-y-8 print:space-y-0">
          {shown.map((s, i) => (
            <div
              key={s.id}
              className={cn("overflow-x-auto print:overflow-visible", i < shown.length - 1 && "print-page-break")}
              data-testid="bulk-document"
            >
              {s.document}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
