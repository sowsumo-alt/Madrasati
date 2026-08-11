import { forwardRef, type InputHTMLAttributes } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export const DateInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <div className="relative">
    <Input
      ref={ref}
      type="date"
      lang="fr"
      className={cn("pr-10", className)}
      {...props}
    />
    <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60 pointer-events-none" />
  </div>
));
DateInput.displayName = "DateInput";
