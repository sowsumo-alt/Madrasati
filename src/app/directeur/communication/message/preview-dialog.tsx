"use client";

import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Aperçu du message tel qu'il arrivera : la mise en forme de WhatsApp
 * (*gras*, _italique_, ~barré~) est rendue, et le texte reste celui du
 * premier destinataire — c'est lui qui porte les variables remplies.
 */
export function PreviewDialog({
  open,
  onOpenChange,
  text,
  recipientName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  recipientName: string | null;
}) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-y-hidden p-0">
        <div className="flex items-center gap-4 border-b border-border px-5 py-4 pe-12 sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-4 ring-primary-50/70">
            <Eye className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg">{t("comm.previewTitle")}</DialogTitle>
            <DialogDescription className="mt-0.5">
              {recipientName
                ? t("comm.previewFor").replace("{name}", recipientName)
                : t("comm.previewGeneric")}
            </DialogDescription>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted/40 px-5 py-5 sm:px-6">
          {/* Bulle de conversation : le directeur voit la forme reçue, pas un champ de saisie. */}
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm ring-1 ring-emerald-100">
            <p className="whitespace-pre-line">{text}</p>
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
