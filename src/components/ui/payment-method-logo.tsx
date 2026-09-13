"use client";

import { useState } from "react";
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

  const src = isPaymentMethod(method) ? PAYMENT_METHOD_LOGOS[method] : undefined;
  if (!src || state === "failed") return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
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
        state === "loaded" ? "h-4 w-4" : "hidden",
        className,
      )}
    />
  );
}
