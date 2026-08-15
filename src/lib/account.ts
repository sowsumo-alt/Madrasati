import bcrypt from "bcryptjs";

/** Plage Unicode des accents laissés par normalize("NFD"). */
const DIACRITICS = /[̀-ͯ]/g;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

/**
 * Fabrique une adresse de connexion à partir du nom, quand la personne n'a pas
 * d'email. Beaucoup de parents mauritaniens n'en ont pas : l'adresse sert
 * alors uniquement d'identifiant, jamais d'envoi de courrier.
 */
export function buildLoginEmail(
  firstName: string,
  lastName: string,
  suffix: string,
) {
  const slug = `${firstName}.${lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9.]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
  return `${slug || "utilisateur"}@${suffix}`;
}

/**
 * Identifiant d'école utilisable dans une adresse : « École Démo Madrasati »
 * devient « ecole-demo-madrasati ».
 */
export function schoolSlug(schoolName: string) {
  return (
    schoolName
      .toLowerCase()
      .normalize("NFD")
      .replace(DIACRITICS, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "ecole"
  );
}

export const PASSWORD_MIN_LENGTH = 8;
