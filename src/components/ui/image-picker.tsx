"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Sélecteur d'image qui redimensionne le fichier dans le navigateur avant de
 * l'enregistrer, puis le stocke en base sous forme de data URI.
 *
 * Pourquoi pas un fichier sur le disque : l'application doit rester déplaçable
 * (aujourd'hui l'ordinateur du directeur, demain un hébergeur) sans traîner un
 * dossier d'images à synchroniser. Le redimensionnement est indispensable —
 * une photo de téléphone fait 4 Mo, ce qui serait intenable en 3G.
 */
export function ImagePicker({
  value,
  onChange,
  maxSize = 320,
  label = "Choisir une image",
  shape = "square",
}: {
  value: string | null;
  onChange: (dataUri: string | null) => void;
  /** Côté maximal en pixels après redimensionnement. */
  maxSize?: number;
  label?: string;
  shape?: "square" | "circle";
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
      onChange(await resizeToDataUri(file, maxSize));
    } catch {
      toast.error("Impossible de lire cette image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-muted ${
          shape === "circle" ? "rounded-full" : "rounded-lg"
        }`}
      >
        {value ? (
          <Image
            src={value}
            alt=""
            width={maxSize}
            height={maxSize}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <ImagePlus className="h-6 w-6 text-foreground/30" />
        )}
      </div>

      <div className="flex flex-col gap-2">
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
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {label}
          </Button>
          {value && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onChange(null)}
            >
              <Trash2 className="h-4 w-4" />
              Retirer
            </Button>
          )}
        </div>
        <p className="text-xs text-foreground/40">
          L&apos;image est réduite automatiquement pour rester légère.
        </p>
      </div>
    </div>
  );
}

/** Réduit l'image à `maxSize` pixels de côté maximum et renvoie un data URI JPEG. */
function resizeToDataUri(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("lecture impossible"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("image illisible"));
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const width = Math.round(img.width * ratio);
        const height = Math.round(img.height * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas indisponible"));
          return;
        }
        // Fond blanc : sans cela un PNG transparent devient noir en JPEG.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
