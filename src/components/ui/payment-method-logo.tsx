"use client";

import { useEffect, useRef, useState } from "react";
import { PAYMENT_METHOD_LOGOS, isPaymentMethod } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

/**
 * Logo d'un mode de paiement, affiché à côté de son libellé.
 *
 * Disparaît de lui-même si le fichier n'est pas là. C'est volontaire : les
 * logos sont déposés à la main dans public/paiement/ (voir le README qui s'y
 * trouve), et une image manquante afficherait sinon une icône cassée sur
 * chaque ligne de paiement. Ici, l'écran retombe simplement sur le libellé
 * seul — celui d'avant — et les logos peuvent être ajoutés un par un.
 *
 * Balise <img> et non le composant Image de Next : ces fichiers sont fournis
 * par l'école, de taille et de forme imprévisibles, et l'optimisation d'images
 * ne sait pas se rattraper toute seule quand le fichier n'existe pas.
 */
export function PaymentMethodLogo({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  // Sur une page préparée par le serveur (le reçu), l'image finit souvent de
  // charger avant que React ne prenne la main : onLoad ne se déclenche alors
  // jamais, et le logo restait caché pour de bon. On relit donc son état dès
  // que le composant est en place.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "loaded" : "failed");
  }, []);

  const src = isPaymentMethod(method) ? PAYMENT_METHOD_LOGOS[method] : undefined;
  if (!src || state === "failed") return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt=""
      aria-hidden
      onLoad={() => setState("loaded")}
      onError={() => setState("failed")}
      // L'image n'occupe aucune place tant qu'elle n'est pas réellement
      // chargée : sans cela, un logo encore absent réservait un carré vide
      // puis disparaissait, faisant sauter la ligne sous les yeux du
      // directeur à chaque ouverture de la liste.
      className={cn(
        "shrink-0 rounded-sm object-contain",
        // Hauteur fixe, largeur libre : les logos des marques sont plus
        // larges que hauts (nom écrit à côté du dessin).
        state === "loaded" ? "h-5 w-auto max-w-[3rem]" : "hidden",
        className,
      )}
    />
  );
}
