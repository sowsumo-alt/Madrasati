/**
 * Marque Madrasati : l'emblème du logo officiel (toque de diplômé, M et
 * livre ouvert), découpé du fichier de marque et exporté en PNG transparent.
 * Le halo blanc du fichier d'origine a été retiré pour que l'emblème reste net
 * sur les bandeaux vert foncé comme sur fond clair.
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
      width={256}
      height={256}
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
