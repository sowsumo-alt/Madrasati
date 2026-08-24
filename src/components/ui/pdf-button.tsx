"use client";

import { useState } from "react";
import { Loader2, Send, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
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
 *
 * La capture passe par html2canvas-pro et non par html2canvas. Ce n'est pas
 * une préférence : depuis le passage à Tailwind v4, la feuille de style
 * compilée contient des couleurs en oklch() et des opacités en color-mix()
 * (« text-foreground/50 »). html2canvas 1.4.1 ne connaît aucune des deux, il
 * levait une erreur dès la première couleur rencontrée — le bouton
 * n'aboutissait jamais, il affichait seulement « la génération du PDF a
 * échoué ». Le fork gère oklch, lab, oklab et color(srgb …), qui sont les
 * formes sous lesquelles le navigateur résout ces couleurs.
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
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        /**
         * Le PDF est un document remis à un parent : il doit ressembler à la
         * version imprimée, pas à l'écran de travail du directeur.
         *
         * La capture photographie le DOM tel qu'il est affiché, et les règles
         * `@media print` ne s'y appliquent jamais. Le bulletin partait donc
         * chez les parents avec les boutons « Regénérer » et « Enregistrer »
         * de l'éditeur d'appréciation, et le texte dans des cadres de saisie.
         * On rejoue donc ici, sur la copie destinée à la capture, ce que
         * l'impression fait d'elle-même : retirer ce qui ne sert qu'à l'écran,
         * révéler la mise en page prévue pour le papier.
         */
        onclone: (doc: Document) => {
          doc.querySelectorAll(".no-print, [data-pdf-ignore]").forEach((el) => el.remove());
          doc.querySelectorAll<HTMLElement>("[data-pdf-show]").forEach((el) => {
            el.classList.remove("hidden");
            el.style.display = "block";
          });
        },
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
