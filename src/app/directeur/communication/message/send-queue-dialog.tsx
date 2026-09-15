"use client";

import { useEffect, useState } from "react";
import { Check, MessageCircle, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { Recipient } from "../communication-view";
import { RecipientAvatar } from "./recipient-avatar";

/**
 * Envoi du message, un destinataire après l'autre. Un lien WhatsApp n'ouvre
 * qu'une conversation : vingt messages ne partent pas d'un seul clic. La
 * fenêtre les met donc en file et coche ceux déjà ouverts, pour n'écrire deux
 * fois à personne — et le texte de chacun est celui du modèle appliqué à lui.
 */
export function SendQueueDialog({
  open,
  onOpenChange,
  recipients,
  messageFor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Recipient[];
  messageFor: (recipient: Recipient) => string;
}) {
  const { t } = useLanguage();
  const [sent, setSent] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (open) setSent(new Set());
  }, [open]);

  const next = recipients.find((r) => !sent.has(r.id));
  const markSent = (id: string) => setSent((prev) => new Set(prev).add(id));

  function openNext() {
    if (!next) return;
    window.open(buildWhatsAppUrl(next.phone, messageFor(next)), "_blank", "noopener,noreferrer");
    markSent(next.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-y-hidden p-0">
        <div className="flex items-center gap-4 border-b border-border px-5 py-4 pe-12 sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/70">
            <MessageCircle className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">{t("comm.queueTitle")}</DialogTitle>
            <DialogDescription className="mt-0.5">{t("comm.queueDescription")}</DialogDescription>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {recipients.map((r) => {
              const done = sent.has(r.id);
              return (
                <li
                  key={r.id}
                  className={cn("flex items-center gap-3 px-3.5 py-2.5", done && "bg-emerald-50/50")}
                >
                  <RecipientAvatar name={r.name} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                    <p className="truncate text-xs text-foreground/55" dir="ltr">
                      {r.phone}
                    </p>
                  </div>
                  {done ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                      <Check className="h-4 w-4" />
                      {t("comm.queueOpened")}
                    </span>
                  ) : (
                    <a
                      href={buildWhatsAppUrl(r.phone, messageFor(r))}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSent(r.id)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {t("comm.queueSend")}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          {!next && recipients.length > 0 && (
            <p className="text-sm font-medium text-emerald-700">{t("comm.queueDone")}</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button type="button" onClick={openNext} disabled={!next}>
            <Send className="h-4 w-4" />
            {t("comm.queueNext")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
