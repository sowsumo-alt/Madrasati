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
 * absent est simplement omis — pas de logo, pas de cercle vide.
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
  const logo = school.logoUrl ? (
    <Image
      src={school.logoUrl}
      alt=""
      width={128}
      height={128}
      unoptimized
      className={styles.logoImage}
    />
  ) : null;

  return (
    <header
      className={`${styles.header} ${official ? "" : styles.plain}`}
      dir="ltr"
      data-testid="document-header"
    >
      {official && (
        <div className={styles.official} data-testid="official-header">
          <div className={styles.officialFr} lang="fr">
            {official.linesFr.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          {logo ? <div className={styles.crest}>{logo}</div> : <div />}
          <div className={styles.officialAr} lang="ar">
            {official.linesAr.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.school}>
        {!official && logo && <div className={styles.logo}>{logo}</div>}
        <div className={styles.name}>{school.name}</div>
        {place && <div className={styles.meta}>{place}</div>}
        {phone && (
          <div className={styles.meta}>
            Tél. <span dir="ltr">{phone}</span>
          </div>
        )}
      </div>
    </header>
  );
}
