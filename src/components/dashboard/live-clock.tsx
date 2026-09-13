"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/lib/format";

/**
 * Heure de l'école, rafraîchie en continu. Le premier affichage reprend
 * l'heure du serveur (`initialIso`) : serveur et navigateur écrivent ainsi
 * exactement la même chose au chargement, avant que l'horloge ne reparte.
 */
export function LiveClock({ initialIso }: { initialIso: string }) {
  const [now, setNow] = useState(() => new Date(initialIso));

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  return <time dateTime={now.toISOString()}>{formatTime(now)}</time>;
}
