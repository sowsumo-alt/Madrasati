"use client";

import { useEffect, useState } from "react";

/**
 * Fait défiler une liste de mots à la fin du titre principal. Le mot le plus
 * long réserve sa largeur en fond (invisible) pour que la ligne ne saute pas
 * d'une rotation à l'autre.
 */
export function RotatingWords({
  words,
  intervalMs = 2600,
  className,
}: {
  words: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");

  return (
    <span className="relative inline-grid align-bottom">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {longest}
      </span>
      <span
        key={index}
        className={`animate-word col-start-1 row-start-1 ${className ?? ""}`}
      >
        {words[index]}
      </span>
    </span>
  );
}
