/**
 * Capture d'un élément de la page en PDF A4, sur autant de pages qu'il faut.
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
export async function exportElementToPdf(element: HTMLElement, fileName: string): Promise<void> {
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

  // JPEG et non PNG : jsPDF range un PNG sans le compresser, et une simple
  // liste de neuf paiements pesait 10 Mo — bien trop pour partir sur WhatsApp
  // avec une connexion lente. En JPEG, le même document tient en quelques
  // centaines de kilo-octets, et la capture en double résolution garde le
  // texte net.
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}
