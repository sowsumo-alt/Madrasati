/**
 * Marque Madrasati : blason officiel (toque, colonnes, livre, laurier),
 * extrait du logo fourni et exporté en PNG transparent. Lisible aussi bien
 * sur fond clair que sur les bandeaux vert foncé de la marque.
 */
import Image from "next/image";

export function Logo({
  className,
  alt = "Madrasati",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src="/logo-crest.png"
      alt={alt}
      width={600}
      height={600}
      className={`object-contain ${className ?? ""}`}
    />
  );
}

/** Logo + nom, tel qu'affiché dans l'en-tête et sur la page de connexion. */
export function LogoWordmark({
  className,
  markClassName = "h-8 w-8",
  textClassName = "text-xl",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <Logo className={markClassName} alt="" />
      <span className={`font-bold tracking-tight text-primary-800 ${textClassName}`}>
        Madrasati
      </span>
    </span>
  );
}
