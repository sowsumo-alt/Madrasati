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
      // Une seule icône : le bouton natif du calendrier de Chrome, rendu
      // invisible, est étiré sous notre icône pour qu'un clic dessus ouvre
      // bien le calendrier — au lieu de deux icônes côte à côte.
      className={cn(
        "pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:end-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
        className,
      )}
      {...props}
    />
    <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60 pointer-events-none" />
  </div>
));
DateInput.displayName = "DateInput";
