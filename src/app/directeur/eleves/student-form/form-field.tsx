import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Libellé, astérisque des champs obligatoires et message d'erreur d'un champ. */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ms-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Champ texte précédé d'une icône (téléphone, adresse, nationalité…). */
export const IconInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }
>(({ icon: Icon, className, ...props }, ref) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
    <Input ref={ref} className={cn("ps-9", className)} {...props} />
  </div>
));
IconInput.displayName = "IconInput";
