import type { SVGProps } from "react";

/** Trois silhouettes pleines (une classe, un groupe d'élèves) : lucide n'a
 *  que des contours, trop maigres dans les grandes pastilles d'en-tête. */
export function UsersGroupIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props} stroke="none">
      <circle cx="12" cy="7" r="3.6" />
      <path d="M5.2 19.2c0-3.6 3-6.2 6.8-6.2s6.8 2.6 6.8 6.2c0 .6-.4 1-1 1H6.2c-.6 0-1-.4-1-1z" />
      <g opacity=".8">
        <circle cx="5" cy="9.2" r="2.6" />
        <path d="M.5 17.8c0-2.6 1.9-4.5 4.4-4.5 1 0 1.9.3 2.6.8-1.4 1.3-2.3 3.1-2.4 5.1H1.3c-.5 0-.8-.3-.8-.8z" />
        <circle cx="19" cy="9.2" r="2.6" />
        <path d="M23.5 17.8c0-2.6-1.9-4.5-4.4-4.5-1 0-1.9.3-2.6.8 1.4 1.3 2.3 3.1 2.4 5.1h3.8c.5 0 .8-.3.8-.8z" />
      </g>
    </svg>
  );
}
