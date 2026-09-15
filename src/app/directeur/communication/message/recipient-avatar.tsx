import { cn } from "@/lib/utils";

/**
 * Initiales du destinataire, dans le vert de la marque comme sur la maquette :
 * la pastille sert à repérer une ligne, pas à distinguer les personnes — le
 * nom s'en charge.
 */
export function RecipientAvatar({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700 ring-1 ring-primary-100",
        className,
      )}
    >
      {initials}
    </span>
  );
}
