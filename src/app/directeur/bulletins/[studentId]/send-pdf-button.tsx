"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useLanguage } from "@/lib/i18n/language-provider";

interface SendPdfButtonProps {
  elementId: string;
  fileName: string;
  parentPhone: string | null;
  message: string;
}

/**
 * WhatsApp ne permet pas de joindre un fichier via un simple lien wa.me (pas
 * d'API de fichiers sans WhatsApp Business, hors de portée ici) : on
 * télécharge donc le bulletin en PDF (capture du rendu déjà affiché à
 * l'écran, logo et arabe RTL compris) puis on ouvre la conversation du
 * parent pour que le directeur y joigne lui-même le fichier téléchargé.
 */
export function SendPdfButton({ elementId, fileName, parentPhone, message }: SendPdfButtonProps) {
  const { t } = useLanguage();
  const [isGenerating, setIsGenerating] = useState(false);

  if (!parentPhone) return null;
  const phone = parentPhone;

  async function handleSend() {
    const element = document.getElementById(elementId);
    if (!element) return;

    setIsGenerating(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(fileName);
      window.open(buildWhatsAppUrl(phone, message), "_blank", "noopener,noreferrer");
      toast.info(t("bulletin.pdfSentInstructions"), { duration: 8000 });
    } catch {
      toast.error(t("bulletin.pdfGenerationFailed"));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleSend} disabled={isGenerating}>
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      {t("bulletin.sendPdf")}
    </Button>
  );
}
