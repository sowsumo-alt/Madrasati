"use client";

import { Printer } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export function PrintButton({
  label = "Imprimer",
  variant,
  onUse,
  beforeUse,
}: {
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  /** Appelé au moment d'imprimer : sert à marquer un document comme remis. */
  onUse?: () => Promise<void>;
  /** Dernière vérification avant l'impression ; renvoie faux pour l'annuler. */
  beforeUse?: () => Promise<boolean>;
}) {
  return (
    <Button
      onClick={async () => {
        if (beforeUse && !(await beforeUse())) return;
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
