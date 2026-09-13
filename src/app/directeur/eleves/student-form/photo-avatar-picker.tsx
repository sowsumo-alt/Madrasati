"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { resizeImageToDataUri } from "@/components/ui/image-picker";

const MAX_SIZE = 240;

/**
 * Photo de l'élève, placée dans l'en-tête du formulaire : un clic sur l'avatar
 * pour la choisir. Elle est réduite dans le navigateur, comme avec
 * ImagePicker, pour rester légère en 3G.
 */
export function PhotoAvatarPicker({
  value,
  onChange,
  addLabel,
  changeLabel,
  removeLabel,
}: {
  value: string | null;
  onChange: (dataUri: string | null) => void;
  addLabel: string;
  changeLabel: string;
  removeLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez un fichier image.");
      return;
    }
    setBusy(true);
    try {
      onChange(await resizeImageToDataUri(file, MAX_SIZE));
    } catch {
      toast.error("Impossible de lire cette image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const label = value ? changeLabel : addLabel;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title={label}
        aria-label={label}
        disabled={busy}
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-primary-600 ring-4 ring-primary-50/70 transition hover:ring-primary-100 focus:outline-none focus-visible:ring-primary-300"
      >
        {value ? (
          <Image
            src={value}
            alt=""
            width={MAX_SIZE}
            height={MAX_SIZE}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound className="h-7 w-7" strokeWidth={1.75} />
        )}
      </button>
      <span className="pointer-events-none absolute -bottom-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white ring-2 ring-surface">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
      </span>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title={removeLabel}
          aria-label={removeLabel}
          className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface text-foreground/60 shadow ring-1 ring-border transition-colors hover:text-danger"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
