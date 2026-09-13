"use client";

import { Printer } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export function PrintButton({
  label = "Imprimer",
  variant,
}: {
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button onClick={() => window.print()} variant={variant} className="no-print">
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}
