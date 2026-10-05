"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Pour un directeur en lecture seule uniquement. Le serveur refuse toute
 * écriture (lib/write-guard.ts) avec une explication claire, mais en
 * production Next.js remplace le message d'une action qui échoue par une
 * phrase technique en anglais — ou l'écran affiche « Une erreur est
 * survenue ». Pour ce compte-là, un tel échec ne peut venir que du refus :
 * on affiche donc la vraie raison, sans toucher à chaque écran.
 */
const GENERIC = [
  /Server Components render/i,
  /unexpected response was received/i,
  /^Une erreur est survenue\.?$/,
  /^Something went wrong\.?$/,
  /^حدث خطأ ما\.?$/,
  /n'a pas abouti/i,
];

export function ReadOnlyToasts({ message }: { message: string }) {
  useEffect(() => {
    const original = toast.error;
    toast.error = ((text: Parameters<typeof toast.error>[0], options?: Parameters<typeof toast.error>[1]) =>
      original(typeof text === "string" && GENERIC.some((re) => re.test(text)) ? message : text, options)) as typeof toast.error;
    return () => {
      toast.error = original;
    };
  }, [message]);
  return null;
}
