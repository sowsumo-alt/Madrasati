import Image from "next/image";
import { cn } from "@/lib/utils";

const TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

/**
 * Photo de l'élève, ou ses initiales sur une teinte tirée de son nom : la même
 * d'une visite à l'autre, pour reconnaître un élève d'un coup d'œil.
 */
export function StudentAvatar({
  firstName,
  lastName,
  photoUrl,
  size = "md",
}: {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm";

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={240}
        height={240}
        unoptimized
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-surface", box)}
      />
    );
  }

  const name = `${firstName}${lastName}`;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        box,
        TONES[hash % TONES.length],
      )}
    >
      {`${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()}
    </span>
  );
}
