import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Champ de saisie de l'application. Le navigateur n'y propose pas les valeurs
 * déjà tapées (autoComplete="off") : en saisissant un élève, la liste des
 * noms d'autres élèves s'affichait sous le champ et gênait la saisie. Les
 * champs de connexion gardent leurs suggestions en passant leur propre
 * autoComplete (« email », « current-password »).
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, autoComplete = "off", ...props }, ref) => (
    <input
      ref={ref}
      autoComplete={autoComplete}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-foreground/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
