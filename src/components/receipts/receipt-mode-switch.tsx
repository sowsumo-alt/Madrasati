import Link from "next/link";
import { Scissors, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReceiptPrintMode } from "./compact-receipt";

/**
 * Choix du format d'impression, à côté du reçu : celui des Paramètres est
 * proposé, le directeur en change d'un clic pour cette impression.
 */
export function ReceiptModeSwitch({
  mode,
  base,
  partnerName,
}: {
  mode: ReceiptPrintMode;
  /** Adresse du reçu, sans paramètres. */
  base: string;
  /** Élève du reçu placé en bas de la feuille, s'il y en a un. */
  partnerName: string | null;
}) {
  const option = (value: ReceiptPrintMode, label: string, hint: string, Icon: typeof Scissors) => (
    <Link
      href={`${base}?mode=${value}`}
      className={cn(
        "flex flex-1 items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
        mode === value
          ? "border-primary-600 bg-primary-50 text-primary-900"
          : "border-border bg-surface text-foreground/70 hover:bg-primary-50/50",
      )}
      data-testid={`receipt-mode-${value}`}
      aria-current={mode === value ? "true" : undefined}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-foreground/55">{hint}</span>
      </span>
    </Link>
  );

  return (
    <div className="no-print mb-4 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {option("TWO_PER_PAGE", "Pleine page", "2 reçus par feuille A4, à couper au milieu", Scissors)}
        {option("HALF_SHEET", "À l'unité", "1 reçu sur une demi-feuille (A5) déjà coupée", StickyNote)}
      </div>
      {mode === "TWO_PER_PAGE" && partnerName && (
        <p className="text-sm text-foreground/65" data-testid="receipt-partner">
          Le reçu de <strong>{partnerName}</strong>, pas encore imprimé, occupe le bas de la feuille.{" "}
          <Link href={`${base}?mode=TWO_PER_PAGE&seul=1`} className="font-semibold text-primary-700 underline">
            Imprimer ce reçu seul
          </Link>
        </p>
      )}
    </div>
  );
}
