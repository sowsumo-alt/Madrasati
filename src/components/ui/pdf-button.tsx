"use client";

import { useState } from "react";
import { Loader2, Send, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { exportElementToPdf } from "@/lib/pdf-export";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

interface PdfButtonProps {
  /** Identifiant de l'élément à capturer (le bulletin, le reçu…). */
  elementId: string;
  fileName: string;
  labelKey: TranslationKey;
  /** Renseigné : le PDF part avec l'ouverture de la conversation du parent. */
  parentPhone?: string | null;
  message?: string;
}

/**
 * Télécharge en PDF le document déjà affiché à l'écran, puis — si un parent
 * est joignable — ouvre sa conversation WhatsApp pour que le directeur y
 * joigne le fichier. WhatsApp ne permet pas d'attacher un fichier depuis un
 * simple lien wa.me : la pièce jointe reste un geste manuel.
 */
export function PdfButton({
  elementId,
  fileName,
  labelKey,
  parentPhone = null,
  message = "",
}: PdfButtonProps) {
  const { t } = useLanguage();
  const [isGenerating, setIsGenerating] = useState(false);
  const sendsToParent = Boolean(parentPhone && message);

  async function handleClick() {
    const element = document.getElementById(elementId);
    if (!element) {
      toast.error(t("pdf.failed"));
      return;
    }

    setIsGenerating(true);
    try {
      await exportElementToPdf(element, fileName);

      if (sendsToParent) {
        window.open(buildWhatsAppUrl(parentPhone!, message), "_blank", "noopener,noreferrer");
        toast.info(t("pdf.sentInstructions"), { duration: 8000 });
      } else {
        toast.success(t("pdf.downloaded"));
      }
    } catch {
      toast.error(t("pdf.failed"));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleClick} disabled={isGenerating}>
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : sendsToParent ? (
        <Send className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {t(labelKey)}
    </Button>
  );
}
