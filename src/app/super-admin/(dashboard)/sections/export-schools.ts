import { formatDate } from "@/lib/format";
import { PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/plans";
import type { SchoolRow } from "./types";

/**
 * Exporte en Excel les écoles affichées — filtre compris, pour que le fichier
 * corresponde toujours à ce que le Super Admin a sous les yeux. Renvoie le
 * nombre d'écoles exportées.
 */
export async function exportSchools(schools: SchoolRow[]): Promise<number> {
  const XLSX = await import("xlsx");
  const rows = schools.map((s) => ({
    Code: s.code,
    École: s.name,
    Ville: s.city ?? "",
    Directeur: s.directorName ?? "",
    Téléphone: s.directorPhone ?? "",
    "Élèves actifs": s.studentCount,
    Formule: PLAN_LABELS[s.plan],
    Statut: SUBSCRIPTION_STATUS_LABELS[s.subscriptionStatus],
    "Jours de retard": s.daysLate ?? 0,
    "Dernier paiement": s.lastPaymentAt ? formatDate(s.lastPaymentAt) : "",
    "Prochaine échéance": s.nextDueAt ? formatDate(s.nextDueAt) : "",
    "Revenu mensuel (MRU)": s.amountDue ?? "Sur devis",
    "Inscrite le": formatDate(s.createdAt),
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Écoles clientes");
  XLSX.writeFile(workbook, `ecoles-madrasati-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return rows.length;
}
