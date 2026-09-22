"use client";

import { Printer } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export function PrintButton({
  label = "Imprimer",
  variant,
  onUse,
}: {
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  /** Appelé au moment d'imprimer : sert à marquer un document comme remis. */
  onUse?: () => Promise<void>;
}) {
  return (
    <Button
      onClick={() => {
        // L'impression ne doit jamais attendre l'enregistrement : la trace
        // part de son côté, et un échec ne bloque pas le document.
        onUse?.().catch(() => {});
        window.print();
      }}
      variant={variant}
      className="no-print"
    >
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}
