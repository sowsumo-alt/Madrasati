import Image from "next/image";
import {
  schoolPhoneLine,
  schoolPlaceLine,
  type OfficialHeaderText,
  type SchoolIdentity,
} from "@/lib/official-header";
import styles from "./document-header.module.css";

/**
 * En-tête de tout document imprimé par une école.
 *
 * L'identité de l'école vient de ses Paramètres (nom, logo, adresse, ville,
 * téléphone) : le directeur ne la saisit jamais ailleurs. Chaque élément
 * absent est simplement omis — pas de logo, pas de cadre vide.
 *
 * Le logo garde toujours ses proportions : carré, rond ou large, il n'est
 * jamais recadré ni étiré. Quand l'école indique que son logo est un en-tête
 * complet (nom et coordonnées déjà dans l'image), il s'imprime seul en
 * pleine largeur, sans répéter ces informations en texte.
 *
 * `official` ajoute au-dessus le bloc de l'État en français et en arabe
 * (documents académiques : bulletins). Son texte est le même pour toutes les
 * écoles ; il vient de loadOfficialHeader() et seul le Super Admin le change.
 */
export function DocumentHeader({
  school,
  official,
}: {
  school: SchoolIdentity;
  official?: OfficialHeaderText | null;
}) {
  const place = schoolPlaceLine(school);
  const phone = schoolPhoneLine(school);
  const banner = school.logoIsLetterhead && school.logoUrl ? school.logoUrl : null;
  const emblem = !banner && school.logoUrl ? school.logoUrl : null;

  return (
    <header
      className={`${styles.header} ${official ? "" : styles.plain}`}
      dir="ltr"
      data-testid="document-header"
    >
      {official && (
        <div
          className={`${styles.official} ${emblem ? "" : styles.officialNoEmblem}`}
          data-testid="official-header"
        >
          <div className={styles.officialFr} lang="fr">
            {official.linesFr.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          {emblem && <Logo src={emblem} className={styles.crest} />}
          <div className={styles.officialAr} lang="ar">
            {official.linesAr.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.school}>
        {banner ? (
          <Logo src={banner} className={styles.banner} testId="school-letterhead" />
        ) : (
          <>
            {!official && emblem && <Logo src={emblem} className={styles.logo} />}
            <div className={styles.name}>{school.name}</div>
            {place && <div className={styles.meta}>{place}</div>}
            {phone && (
              <div className={styles.meta}>
                Tél. <span dir="ltr">{phone}</span>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}

/**
 * L'image de l'école à ses proportions d'origine : la taille est fixée par
 * le CSS (hauteur maximale), la largeur suit l'image.
 */
function Logo({ src, className, testId }: { src: string; className: string; testId?: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={1000}
      height={1000}
      unoptimized
      className={className}
      data-testid={testId}
    />
  );
}
