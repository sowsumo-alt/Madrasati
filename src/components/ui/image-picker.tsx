"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trimmedBounds } from "@/lib/image-trim";

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
  wide = false,
}: {
  value: string | null;
  onChange: (dataUri: string | null) => void;
  /** Côté maximal en pixels après redimensionnement, ou largeur et hauteur maximales. */
  maxSize?: MaxSize;
  label?: string;
  shape?: "square" | "circle";
  /**
   * Aperçu élargi, image entière sans recadrage : pour un logo qui peut être
   * un en-tête large (symbole, nom et coordonnées dans la même image).
   */
  wide?: boolean;
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
      // Un logo (aperçu large) perd ses bandes noires ou blanches de bord.
      onChange(await resizeImageToDataUri(file, maxSize, { trimBorders: wide }));
    } catch {
      toast.error("Impossible de lire cette image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    // flex-wrap : sur téléphone, les boutons passent sous un logo large au
    // lieu de sortir de l'écran.
    <div className="flex flex-wrap items-center gap-4">
      <div
        className={`flex h-20 shrink-0 items-center justify-center overflow-hidden border border-border ${
          wide ? "w-60 max-w-full bg-white p-1" : "w-20 bg-surface-muted"
        } ${shape === "circle" ? "rounded-full" : "rounded-lg"}`}
      >
        {value ? (
          <Image
            src={value}
            alt=""
            width={320}
            height={320}
            unoptimized
            className={`h-full w-full ${wide ? "object-contain" : "object-cover"}`}
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

type MaxSize = number | { width: number; height: number };

/**
 * Taille maximale d'un data URI, en caractères. Une action serveur de Next
 * refuse au-delà d'1 Mo : on garde de la marge pour les autres champs.
 */
const MAX_DATA_URI_CHARS = 700_000;

/**
 * Réduit l'image à `maxSize` pixels de côté maximum (ou dans le cadre
 * largeur × hauteur donné), sans jamais la déformer, et renvoie un data URI
 * JPEG. Exportée pour les sélecteurs de photo plus compacts (avatar du
 * formulaire élève), qui doivent réduire l'image de la même façon.
 *
 * `trimBorders` : retire d'abord les bandes unies, noires ou blanches, du
 * bord de l'image (voir lib/image-trim.ts) — pour un logo ou un en-tête.
 */
export function resizeImageToDataUri(
  file: File,
  maxSize: MaxSize,
  { trimBorders = false }: { trimBorders?: boolean } = {},
): Promise<string> {
  const box = typeof maxSize === "number" ? { width: maxSize, height: maxSize } : maxSize;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("lecture impossible"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("image illisible"));
      img.onload = () => {
        const crop = trimBorders ? borderCrop(img) : { x: 0, y: 0, width: img.width, height: img.height };
        const ratio = Math.min(box.width / crop.width, box.height / crop.height, 1);
        const width = Math.round(crop.width * ratio);
        const height = Math.round(crop.height * ratio);

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
        ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
        // Une grande image très détaillée peut dépasser la limite : on baisse
        // la qualité par paliers plutôt que de refuser l'image.
        let quality = 0.82;
        let uri = canvas.toDataURL("image/jpeg", quality);
        while (uri.length > MAX_DATA_URI_CHARS && quality > 0.4) {
          quality -= 0.15;
          uri = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(uri);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Zone de l'image sans ses bords unis. L'analyse se fait sur une copie
 * réduite (800 px de large au plus) : une photo de téléphone en 4000 px
 * serait lente à parcourir pixel par pixel, pour le même résultat.
 */
function borderCrop(img: HTMLImageElement) {
  const full = { x: 0, y: 0, width: img.width, height: img.height };
  const scale = Math.min(800 / img.width, 1);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return full;
  ctx.drawImage(img, 0, 0, w, h);
  const b = trimmedBounds(ctx.getImageData(0, 0, w, h).data, w, h);
  if (b.left === 0 && b.top === 0 && b.right === w && b.bottom === h) return full;
  // Un pixel de marge en plus : la réduction mêle le bord et l'image.
  const x = Math.min(img.width - 1, Math.ceil((b.left + (b.left ? 1 : 0)) / scale));
  const y = Math.min(img.height - 1, Math.ceil((b.top + (b.top ? 1 : 0)) / scale));
  const right = Math.max(x + 1, Math.floor((b.right - (b.right < w ? 1 : 0)) / scale));
  const bottom = Math.max(y + 1, Math.floor((b.bottom - (b.bottom < h ? 1 : 0)) / scale));
  return { x, y, width: right - x, height: bottom - y };
}
