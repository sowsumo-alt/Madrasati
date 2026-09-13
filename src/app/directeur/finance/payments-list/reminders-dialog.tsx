"use client";

import { useEffect, useState } from "react";
import { Check, MessageCircle, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatMRU } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { FeeRow } from "../finance-view";

/**
 * Relance groupée des parents. Un lien WhatsApp n'ouvre qu'une conversation :
 * vingt rappels ne partent pas d'un seul clic. La fenêtre les met donc en
 * file — « Ouvrir le suivant » ouvre la conversation du parent suivant — et
 * coche chaque ligne ouverte, pour ne relancer personne deux fois.
 */
export function RemindersDialog({
  open,
  onOpenChange,
  fees,
  reminderUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Frais cochés, réglés ou non. */
  fees: FeeRow[];
  reminderUrl: (fee: FeeRow) => string | null;
}) {
  const { t } = useLanguage();
  const [opened, setOpened] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (open) setOpened(new Set());
  }, [open]);

  const unsettled = fees.filter((f) => f.remaining > 0);
  const sendable = unsettled.filter((f) => reminderUrl(f) != null);
  const withoutPhone = unsettled.filter((f) => reminderUrl(f) == null);
  const settledCount = fees.length - unsettled.length;
  const next = sendable.find((f) => !opened.has(f.id));

  const markOpened = (id: string) => setOpened((prev) => new Set(prev).add(id));

  function openNext() {
    const url = next ? reminderUrl(next) : null;
    if (!next || !url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    markOpened(next.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-y-hidden p-0">
        <div className="flex items-center gap-4 border-b border-border px-5 py-4 pe-12 sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/70">
            <MessageCircle className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">{t("finance.remindersTitle")}</DialogTitle>
            <DialogDescription className="mt-0.5">{t("finance.remindersDescription")}</DialogDescription>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          {sendable.length === 0 ? (
            <p className="rounded-xl bg-surface-muted/60 px-4 py-6 text-center text-sm text-foreground/60">
              {t("finance.remindersNone")}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {sendable.map((fee) => {
                const done = opened.has(fee.id);
                return (
                  <li
                    key={fee.id}
                    className={cn("flex items-center gap-3 px-3.5 py-2.5", done && "bg-emerald-50/50")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {fee.student.firstName} {fee.student.lastName}
                      </p>
                      <p className="truncate text-xs text-foreground/55">
                        {fee.label} · {t("finance.remainingIs").replace("{amount}", formatMRU(fee.remaining))}
                      </p>
                    </div>
                    {done ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                        <Check className="h-4 w-4" />
                        {t("finance.remindersOpened")}
                      </span>
                    ) : (
                      <a
                        href={reminderUrl(fee) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markOpened(fee.id)}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {t("finance.remindersSend")}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {sendable.length > 0 && !next && (
            <p className="text-sm font-medium text-emerald-700">{t("finance.remindersDone")}</p>
          )}
          {withoutPhone.length > 0 && (
            <p className="text-xs text-foreground/55">
              {t("finance.remindersNoPhone").replace(
                "{names}",
                withoutPhone.map((f) => `${f.student.firstName} ${f.student.lastName}`).join(", "),
              )}
            </p>
          )}
          {settledCount > 0 && (
            <p className="text-xs text-foreground/55">
              {t("finance.remindersSkippedPaid").replace("{n}", String(settledCount))}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button type="button" onClick={openNext} disabled={!next}>
            <Send className="h-4 w-4" />
            {t("finance.remindersNext")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
